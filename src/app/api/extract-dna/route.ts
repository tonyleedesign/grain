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

export const maxDuration = 120

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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: OBSERVE_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content }],
  })

  console.log(`[Pass 1] tokens — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}`)

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

  console.log(`[Pass 2] tokens — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}`)

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
      boardId: requestedBoardId,
      boardName,
      canvasId,
      frameShapeId,
      medium,
      useCase,
      sourceContext,
      appealContext,
      imageUrls,
      observations: providedObservations,
      feedback,
      previousDna,
    } = (await request.json()) as {
      boardId?: string
      boardName: string
      canvasId: string
      frameShapeId?: string
      medium: Medium
      useCase?: string
      sourceContext?: string
      appealContext?: string
      imageUrls: string[]
      observations?: string
      feedback?: string
      previousDna?: Record<string, unknown>
    }

    if ((!requestedBoardId && !boardName) || !canvasId || !medium || !imageUrls?.length) {
      return NextResponse.json(
        { error: 'boardId or boardName, plus canvasId, medium, and imageUrls are required' },
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

    // Resolve or create the canonical board identity row first. Prefer
    // frame-linked boards over name-only matches so a single canvas board
    // cannot silently fan out into duplicate DB rows.
    let boardId: string | null = requestedBoardId || null

    let existingBoard: { id: string } | null = null

    if (!boardId && frameShapeId) {
      const { data: byFrame, error: byFrameError } = await supabaseServer
        .from('boards')
        .select('id')
        .eq('canvas_id', canvasId)
        .eq('frame_shape_id', frameShapeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (byFrameError) {
        console.error('Board lookup by frame error:', byFrameError)
      }

      existingBoard = byFrame
    }

    if (!existingBoard && !boardId && boardName) {
      const { data: byName, error: byNameError } = await supabaseServer
        .from('boards')
        .select('id')
        .eq('canvas_id', canvasId)
        .eq('name', boardName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (byNameError) {
        console.error('Board lookup by name error:', byNameError)
      }

      existingBoard = byName
    }

    if (existingBoard?.id) {
      boardId = existingBoard.id
      if (frameShapeId) {
        const { error: attachFrameError } = await supabaseServer
          .from('boards')
          .update({ frame_shape_id: frameShapeId })
          .eq('id', boardId)

        if (attachFrameError) {
          console.error('Board frame attach error:', attachFrameError)
        }
      }
    } else {
      const { data: insertedBoard, error: insertBoardError } = await supabaseServer
        .from('boards')
        .insert({
          canvas_id: canvasId,
          name: boardName || 'Untitled',
          frame_shape_id: frameShapeId || null,
        })
        .select('id')
        .single()

      if (insertBoardError || !insertedBoard) {
        console.error('Board insert error:', insertBoardError)
      } else {
        boardId = insertedBoard.id
      }
    }

    if (!boardId) {
      throw new Error('Failed to resolve board before saving extraction')
    }

    // Persist extraction history separately from the stable board record.
    const { data: extractionRow, error: extractionError } = await supabaseServer
      .from('board_extractions')
      .insert({
        board_id: boardId,
        medium,
        use_case: useCase || null,
        source_context: sourceContext || null,
        appeal_context: appealContext || null,
        dna_data: dna,
        observations,
      })
      .select('id')
      .single()

    if (extractionError || !extractionRow) {
      console.error('Board extraction insert error:', extractionError)
    } else {
      const { error: latestExtractionError } = await supabaseServer
        .from('boards')
        .update({ latest_extraction_id: extractionRow.id })
        .eq('id', boardId)

      if (latestExtractionError) {
        console.error('Board latest extraction update error:', latestExtractionError)
      }
    }

    return NextResponse.json({ boardId, medium, dna, observations })
  } catch (error) {
    console.error('Extract DNA error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'DNA extraction failed' },
      { status: 500 }
    )
  }
}
