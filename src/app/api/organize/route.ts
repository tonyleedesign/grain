// Organize API route — sends images to Claude Vision for grouping + DNA extraction.
// Reference: grain-prd.md Section 5.3, 14

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CanvasImage, OrganizeResult } from '@/types/dna'
import { supabaseServer } from '@/lib/supabase-server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const FONT_LIST = [
  'Bricolage Grotesque', 'DM Sans', 'Plus Jakarta Sans', 'Nunito',
  'Geist', 'Inter', 'Space Grotesk', 'Syne', 'Bebas Neue',
  'Fraunces', 'Playfair Display', 'Cormorant Garamond', 'Unbounded', 'Lexend',
].join(', ')

const SYSTEM_PROMPT = `You are a senior product and visual designer with strong taste.
Your job is to analyze a set of images and extract their shared design patterns.
Do NOT give generic labels like "modern", "clean", or "minimal".
Everything you say must be grounded in visible, repeated patterns across the images.
Avoid fluff, filler, and vague adjectives.`

function buildUserPrompt(imageCount: number): string {
  return `Analyze these ${imageCount} images and group them by visual similarity. For each group, extract a clear Design DNA.

Return your answer as a JSON object with this exact structure:
{
  "boards": [
    {
      "image_indices": [0, 2, 4],
      "dna": {
        "board_name": "2-4 words, concise and distinctive. Avoid generic names like Modern Minimalism",
        "core_patterns": ["4-6 items, each describing something visual and repeatable. Be concrete: muted warm neutrals not nice colors"],
        "color_palette": {
          "description": "describe the palette in words",
          "hex_values": ["#hex1", "#hex2", "#hex3", "#hex4"]
        },
        "mood_tags": ["3-5 mood words"],
        "style_tags": ["3-5 style tags like Brutalist, Bauhaus, Wabi-Sabi"],
        "material_tags": ["2-4 material/texture references like Raw concrete, Linen"],
        "composition": "Layout tendencies: grid, asymmetry, spacing, density",
        "era_reference": "Era or aesthetic movement reference",
        "overall_feel": "1-2 lines max. Synthesis, not a list of adjectives",
        "what_makes_distinct": "What separates this group from other possible directions",
        "typography_direction": "Describe type style, not just font names",
        "font_pairing": {
          "display": "font name + weight from this list: ${FONT_LIST}",
          "body": "font name + weight from this list: ${FONT_LIST}",
          "reasoning": "one sentence why this pairing fits"
        }
      }
    }
  ]
}

Rules:
- Each image must belong to exactly one board
- Minimum 2 images per board. If an image doesn't fit any group well, find its closest match.
- image_indices are zero-based indices matching the order images were provided
- Only include patterns clearly visible across multiple images in a group

Before finalizing, check:
- Did you use any vague or generic terms?
- Are all patterns clearly visible across multiple images?
- Would a designer who created these images recognize their own aesthetic in this output?
If not, revise to be more specific.

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
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    // Extract text response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse the JSON response
    const parsed = JSON.parse(textBlock.text) as {
      boards: { image_indices: number[]; dna: OrganizeResult['boards'][number]['dna'] }[]
    }

    // Map image_indices back to image IDs
    const result: OrganizeResult = {
      boards: parsed.boards.map((board) => ({
        dna: board.dna,
        image_ids: board.image_indices.map((i) => images[i].id),
      })),
    }

    // Save boards to Supabase (server-side, bypasses RLS)
    if (canvasId) {
      for (const board of result.boards) {
        const { error: dbError } = await supabaseServer.from('boards').insert({
          canvas_id: canvasId,
          name: board.dna.board_name,
          color_palette: board.dna.color_palette,
          core_patterns: board.dna.core_patterns,
          mood_tags: board.dna.mood_tags,
          style_tags: board.dna.style_tags,
          material_tags: board.dna.material_tags,
          composition_notes: board.dna.composition,
          era_reference: board.dna.era_reference,
          typography_display: board.dna.font_pairing.display,
          typography_body: board.dna.font_pairing.body,
          typography_reasoning: board.dna.font_pairing.reasoning,
          what_makes_distinct: board.dna.what_makes_distinct,
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
