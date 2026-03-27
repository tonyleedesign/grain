// Canvas AI API route — Claude with tool-use for canvas actions.
// Receives selection context + user message, returns tool calls to execute client-side.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { CanvasAIRequest, CanvasAIResponse, CanvasAIToolCall } from '@/types/canvas-ai'
import { CANVAS_AI_SYSTEM, CANVAS_AI_TOOLS } from './tools'

export const maxDuration = 30

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

function buildUserMessage(req: CanvasAIRequest): string {
  const { message, context } = req
  const parts: string[] = []

  parts.push(`User message: "${message}"`)
  parts.push('')
  parts.push(`Selection: ${context.selectionType}`)

  if (context.selectedImages) {
    const { urls, ungrouped, boardName } = context.selectedImages
    parts.push(`Selected images: ${urls.length} image(s)${ungrouped ? ' (ungrouped)' : ` in board "${boardName}"`}`)
  }

  if (context.selectedBoards) {
    parts.push(`Selected boards: ${context.selectedBoards.names.join(', ')}`)
    if (context.selectedBoards.dnaSummaries?.length) {
      context.selectedBoards.dnaSummaries.forEach((summary, i) => {
        parts.push(`  ${context.selectedBoards!.names[i]}: ${summary}`)
      })
    }
  }

  parts.push('')
  parts.push(`Canvas overview: ${context.canvasOverview.totalBoards} boards, ${context.canvasOverview.totalUngroupedImages} ungrouped images`)
  if (context.canvasOverview.boardNames.length > 0) {
    parts.push(`Board names: ${context.canvasOverview.boardNames.join(', ')}`)
  }

  return parts.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CanvasAIRequest

    if (!body.message || !body.context || !body.canvasId) {
      return NextResponse.json(
        { error: 'message, context, and canvasId are required' },
        { status: 400 }
      )
    }

    const userMessage = buildUserMessage(body)

    // Include image URLs as vision content if images are selected
    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: userMessage },
    ]

    if (body.context.selectedImages?.urls.length) {
      for (const url of body.context.selectedImages.urls) {
        content.push({
          type: 'image' as const,
          source: { type: 'url' as const, url },
        })
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: CANVAS_AI_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: CANVAS_AI_TOOLS,
      messages: [{ role: 'user', content }],
    })

    console.log(`[canvas-ai] tokens — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}`)

    // Extract tool calls and text from response
    const toolCalls: CanvasAIToolCall[] = []
    let textResponse: string | undefined

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          input: block.input as Record<string, unknown>,
        })
      } else if (block.type === 'text' && block.text.trim()) {
        textResponse = block.text.trim()
      }
    }

    // If Claude responded with text but no place_text tool call, wrap it as one
    if (textResponse && !toolCalls.some((tc) => tc.name === 'place_text')) {
      toolCalls.push({
        name: 'place_text',
        input: { text: textResponse, position: 'near_selection' },
      })
      textResponse = undefined
    }

    const result: CanvasAIResponse = { toolCalls, textResponse }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Canvas AI error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Canvas AI failed' },
      { status: 500 }
    )
  }
}
