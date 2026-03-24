// Extract DNA API — medium-aware DNA extraction from board images.
// Called after user selects medium + optional use case on a board.
// Reference: grain-prd.md Section 5.3

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Medium } from '@/types/dna'
import { supabaseServer } from '@/lib/supabase-server'
import {
  WEB_APP_SYSTEM,
  IMAGE_GEN_SYSTEM,
  buildWebAppPrompt,
  buildImageGenPrompt,
} from './prompts'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const { boardName, canvasId, medium, useCase, sourceContext, appealContext, imageUrls, feedback, previousDna } =
      (await request.json()) as {
        boardName: string
        canvasId: string
        medium: Medium
        useCase?: string
        sourceContext?: string
        appealContext?: string
        imageUrls: string[]
        feedback?: string
        previousDna?: Record<string, unknown>
      }

    if (!boardName || !canvasId || !medium || !imageUrls?.length) {
      return NextResponse.json(
        { error: 'boardName, canvasId, medium, and imageUrls are required' },
        { status: 400 }
      )
    }

    // Select prompt based on medium
    const systemPrompt = medium === 'web' ? WEB_APP_SYSTEM : IMAGE_GEN_SYSTEM
    const userPromptBuilder = medium === 'web' ? buildWebAppPrompt : buildImageGenPrompt
    let userPrompt = userPromptBuilder(imageUrls.length, useCase, sourceContext, appealContext)

    // Inject feedback + previous DNA if regenerating
    if (feedback) {
      let feedbackBlock = `\n\nIMPORTANT — the user rejected the previous extraction with this feedback: "${feedback}"\nThis feedback takes PRIORITY over what you see in the images. If the user says the colors are wrong, generate DIFFERENT colors that match the mood and direction — do not repeat or slightly adjust the previous palette. The user's creative direction overrides literal image sampling.`

      if (previousDna) {
        feedbackBlock += `\n\nHere is the REJECTED extraction — do NOT repeat these values. Change what the user asked you to change:\n${JSON.stringify(previousDna, null, 2)}`
      }

      userPrompt += feedbackBlock
    }

    // Build content blocks: text prompt + image URLs
    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: userPrompt },
      ...imageUrls.map((url) => ({
        type: 'image' as const,
        source: {
          type: 'url' as const,
          url,
        },
      })),
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content }],
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Clean up Claude's response — strip markdown fences, trailing commas
    let jsonText = textBlock.text.trim()
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    jsonText = jsonText.replace(/,\s*([}\]])/g, '$1')
    const dna = JSON.parse(jsonText)

    // Upsert DNA to Supabase — try update first, insert if no row exists
    const { data: updated, error: updateError } = await supabaseServer
      .from('boards')
      .update({
        medium,
        use_case: useCase || null,
        dna_data: dna,
      })
      .eq('canvas_id', canvasId)
      .eq('name', boardName)
      .select('id')

    if (updateError) {
      console.error('DNA update error:', updateError)
    }

    // If no row was updated (board wasn't in DB), insert it with DNA
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabaseServer
        .from('boards')
        .insert({
          canvas_id: canvasId,
          name: boardName,
          medium,
          use_case: useCase || null,
          dna_data: dna,
        })

      if (insertError) {
        console.error('DNA insert error:', insertError)
      }
    }

    return NextResponse.json({ medium, dna })
  } catch (error) {
    console.error('Extract DNA error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'DNA extraction failed' },
      { status: 500 }
    )
  }
}
