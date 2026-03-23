// Organize API route — groups images by visual similarity using Claude Vision.
// DNA extraction happens separately via /api/extract-dna after medium selection.
// Reference: grain-prd.md Section 5.3

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CanvasImage } from '@/types/dna'
import { supabaseServer } from '@/lib/supabase-server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT = `You are an image grouping assistant with strong visual taste.
Your job is to group images by visual similarity — shared color palettes, textures, moods, and compositional patterns.
Give each group a short, distinctive 2-4 word name that captures what makes it visually cohesive.
Avoid generic names like "Modern Minimalism" or "Clean Design".`

function buildUserPrompt(imageCount: number): string {
  return `Group these ${imageCount} images by visual similarity.

Return your answer as a JSON object with this exact structure:
{
  "boards": [
    {
      "board_name": "2-4 words, concise and distinctive",
      "image_indices": [0, 2, 4]
    }
  ]
}

Rules:
- Each image must belong to exactly one board
- Minimum 2 images per board. If an image doesn't fit any group well, find its closest match.
- image_indices are zero-based indices matching the order images were provided
- Board names must be specific to the visual content, not generic labels

Return ONLY valid JSON, no markdown fences, no explanation.`
}

export async function POST(request: NextRequest) {
  try {
    const { images, canvasId } = (await request.json()) as {
      images: CanvasImage[]
      canvasId: string
    }

    if (!images?.length) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    // Build content blocks: text prompt + image URLs
    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: buildUserPrompt(images.length) },
      ...images.map((img) => ({
        type: 'image' as const,
        source: {
          type: 'url' as const,
          url: img.url,
        },
      })),
    ]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    // Extract text response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Clean up Claude's response — strip markdown fences, trailing commas
    let jsonText = textBlock.text.trim()
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    jsonText = jsonText.replace(/,\s*([}\]])/g, '$1')
    const parsed = JSON.parse(jsonText) as {
      boards: { board_name: string; image_indices: number[] }[]
    }

    // Map image_indices back to image IDs
    const result = {
      boards: parsed.boards.map((board) => ({
        board_name: board.board_name,
        image_ids: board.image_indices.map((i) => images[i].id),
      })),
    }

    // Save board stubs to Supabase (no DNA yet — extracted separately after medium selection)
    if (canvasId) {
      for (const board of result.boards) {
        const { error: dbError } = await supabaseServer.from('boards').insert({
          canvas_id: canvasId,
          name: board.board_name,
        })
        if (dbError) {
          console.error('Board save error:', dbError)
        }
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Organize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Organize failed' },
      { status: 500 }
    )
  }
}
