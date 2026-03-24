// Extract DNA API — two-pass extraction from board images.
// Pass 1 (Observe): images + source context → unstructured observations (extended thinking)
// Pass 2 (Synthesize): observations + user intent + schema → structured DNA JSON
// Reference: PLAN.md, memory/project_two_pass_extraction.md

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Medium } from '@/types/dna'
import { supabaseServer } from '@/lib/supabase-server'
import {
  OBSERVE_SYSTEM,
  WEB_SYNTHESIZE_SYSTEM,
  IMAGE_GEN_SYNTHESIZE_SYSTEM,
  buildObservePrompt,
  buildWebAppSynthesizePrompt,
  buildImageGenSynthesizePrompt,
} from './prompts'
import { matchFonts, formatFontShortlist } from '@/lib/font-matcher'
import { extractSignals } from '@/lib/observation-signals'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Pass 1: Observe images — uncontaminated, no schema, no use case, no appeal context
async function runObservation(
  imageUrls: string[],
  sourceContext?: string
): Promise<string> {
  const userPrompt = buildObservePrompt(imageUrls.length, sourceContext)

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

  let response: Anthropic.Messages.Message
  try {
    // Try with extended thinking first — improves observation depth
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 8000,
      },
      system: [
        {
          type: 'text',
          text: OBSERVE_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content }],
    })
  } catch (thinkingError) {
    // Fallback: retry without extended thinking if API rejects it
    console.warn('Extended thinking rejected, retrying without:', thinkingError)
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: [
        {
          type: 'text',
          text: OBSERVE_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content }],
    })
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text' || !textBlock.text.trim()) {
    throw new Error('Pass 1 returned empty observations')
  }

  return textBlock.text
}

// Pass 2: Synthesize DNA from observations — applies user intent, no images
async function runSynthesis(
  observations: string,
  medium: Medium,
  imageCount: number,
  useCase?: string,
  sourceContext?: string,
  appealContext?: string,
  feedback?: string,
  previousDna?: Record<string, unknown>,
  fontShortlist?: string
): Promise<Record<string, unknown>> {
  const systemPrompt = medium === 'web' ? WEB_SYNTHESIZE_SYSTEM : IMAGE_GEN_SYNTHESIZE_SYSTEM
  const promptBuilder = medium === 'web' ? buildWebAppSynthesizePrompt : buildImageGenSynthesizePrompt

  const userPrompt = promptBuilder(
    observations,
    imageCount,
    useCase,
    sourceContext,
    appealContext,
    feedback,
    previousDna,
    medium === 'web' ? fontShortlist : undefined
  )

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6144,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Pass 2 returned no text response')
  }

  // Clean up — strip markdown fences, trailing commas
  let jsonText = textBlock.text.trim()
  jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  jsonText = jsonText.replace(/,\s*([}\]])/g, '$1')
  return JSON.parse(jsonText)
}

export async function POST(request: NextRequest) {
  try {
    const {
      boardName,
      canvasId,
      medium,
      useCase,
      sourceContext,
      appealContext,
      imageUrls,
      observations: providedObservations,
      feedback,
      previousDna,
    } = (await request.json()) as {
      boardName: string
      canvasId: string
      medium: Medium
      useCase?: string
      sourceContext?: string
      appealContext?: string
      imageUrls: string[]
      observations?: string
      feedback?: string
      previousDna?: Record<string, unknown>
    }

    if (!boardName || !canvasId || !medium || !imageUrls?.length) {
      return NextResponse.json(
        { error: 'boardName, canvasId, medium, and imageUrls are required' },
        { status: 400 }
      )
    }

    // Pass 1: Observe (skip if observations provided — regeneration path)
    let observations: string
    if (providedObservations) {
      observations = providedObservations
    } else {
      observations = await runObservation(imageUrls, sourceContext)
    }

    // Generate font shortlist from observation signals (web only)
    let fontShortlist: string | undefined
    if (medium === 'web') {
      const signals = extractSignals(observations)
      // Get display candidates (broader: include display-weight classifications)
      const displayFonts = matchFonts({
        classifications: [...signals.classifications, 'display'],
        moods: signals.moods,
        role: 'display',
        limit: 20,
      })
      // Get body candidates (readable classifications)
      const bodyFonts = matchFonts({
        classifications: ['humanist-sans', 'neo-grotesque', 'transitional-serif', 'mono'],
        moods: signals.moods,
        role: 'body',
        limit: 15,
      })
      const displayList = formatFontShortlist(displayFonts)
      const bodyList = formatFontShortlist(bodyFonts)
      if (displayList || bodyList) {
        fontShortlist = `Display font candidates:\n${displayList}\n\nBody font candidates:\n${bodyList}`
      }
    }

    // Pass 2: Synthesize
    const dna = await runSynthesis(
      observations,
      medium,
      imageUrls.length,
      useCase,
      sourceContext,
      appealContext,
      feedback,
      previousDna,
      fontShortlist
    )

    // Upsert DNA + observations to Supabase
    const { data: updated, error: updateError } = await supabaseServer
      .from('boards')
      .update({
        medium,
        use_case: useCase || null,
        source_context: sourceContext || null,
        appeal_context: appealContext || null,
        dna_data: dna,
        observations,
      })
      .eq('canvas_id', canvasId)
      .eq('name', boardName)
      .select('id')

    if (updateError) {
      console.error('DNA update error:', updateError)
    }

    // If no row was updated, insert
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabaseServer
        .from('boards')
        .insert({
          canvas_id: canvasId,
          name: boardName,
          medium,
          use_case: useCase || null,
          source_context: sourceContext || null,
          appeal_context: appealContext || null,
          dna_data: dna,
          observations,
        })

      if (insertError) {
        console.error('DNA insert error:', insertError)
      }
    }

    return NextResponse.json({ medium, dna, observations })
  } catch (error) {
    console.error('Extract DNA error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'DNA extraction failed' },
      { status: 500 }
    )
  }
}
