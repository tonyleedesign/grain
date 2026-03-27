// Canvas AI API route — Claude with tool-use for canvas actions.
// Receives selection context + user message, returns tool calls to execute client-side.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { CanvasAIRequest, CanvasAIResponse, CanvasAIToolCall, CanvasAIChatRequest } from '@/types/canvas-ai'
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
    if (context.selectedBoards.boards.length > 0) {
      parts.push('Board details:')
      context.selectedBoards.boards.forEach((board) => {
        parts.push(`  - ${board.name}: ${board.imageCount} image(s)`)
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

async function handleSingleShot(body: CanvasAIRequest) {
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
    tool_choice: { type: 'any' },
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

  // analyze_selection is a reasoning aid, not a visible canvas action
  const executableToolCalls = toolCalls.filter((tc) => tc.name !== 'analyze_selection')

  // If Claude responded with text but no place_text tool call, wrap it as one
  if (textResponse && !executableToolCalls.some((tc) => tc.name === 'place_text')) {
    executableToolCalls.push({
      name: 'place_text',
      input: { text: textResponse, position: 'near_selection' },
    })
    textResponse = undefined
  }

  // Guarantee analysis requests produce a visible canvas artifact
  if (
    toolCalls.some((tc) => tc.name === 'analyze_selection') &&
    !textResponse &&
    !executableToolCalls.some((tc) => tc.name === 'place_text')
  ) {
    executableToolCalls.push({
      name: 'place_text',
      input: {
        text: "I couldn't generate a clear analysis for this selection. Try asking more specifically.",
        position: 'near_selection',
      },
    })
  }

  const result: CanvasAIResponse = { toolCalls: executableToolCalls, textResponse }
  return NextResponse.json(result)
}

async function handleChatStream(body: CanvasAIChatRequest) {
  if (!body.messages?.length || !body.canvasId) {
    return NextResponse.json(
      { error: 'messages and canvasId are required' },
      { status: 400 }
    )
  }

  // Build multi-turn messages array for Claude
  const claudeMessages: Anthropic.Messages.MessageParam[] = []
  let originalContextNote = ''

  try {
    const origCtx = JSON.parse(body.originalContext)
    if (origCtx.selectionType && origCtx.selectionType !== 'none') {
      originalContextNote = `\nOriginal conversation context: ${origCtx.selectionType} selection`
      if (origCtx.selectedBoards?.names) {
        originalContextNote += ` — boards: ${origCtx.selectedBoards.names.join(', ')}`
      }
    }
  } catch {}

  let currentContextNote = ''
  if (body.currentContext?.selectionType && body.currentContext.selectionType !== 'none') {
    currentContextNote = `\nCurrent selection: ${body.currentContext.selectionType}`
  }

  for (const msg of body.messages) {
    if (msg.role === 'user') {
      let text = msg.text
      if (claudeMessages.length === 0 && (originalContextNote || currentContextNote)) {
        text = `${text}${originalContextNote}${currentContextNote}`
      }
      claudeMessages.push({ role: 'user', content: text })
    } else {
      claudeMessages.push({ role: 'assistant', content: msg.text })
    }
  }

  // Include images from the most recent user turn if available
  const lastUserIdx = [...claudeMessages].map((msg) => msg.role).lastIndexOf('user')
  if (body.currentContext?.selectedImages?.urls.length && lastUserIdx >= 0 && claudeMessages[lastUserIdx]?.role === 'user') {
    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: claudeMessages[lastUserIdx].content as string },
    ]
    for (const url of body.currentContext.selectedImages.urls) {
      content.push({
        type: 'image' as const,
        source: { type: 'url' as const, url },
      })
    }
    claudeMessages[lastUserIdx] = { role: 'user', content }
  }

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: CANVAS_AI_SYSTEM + '\n\nYou are in a multi-turn conversation. Respond naturally with text. Do NOT use tools unless the user explicitly asks for a canvas action (rename, group, delete, extract DNA).',
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: claudeMessages,
        })

        stream.on('text', (text) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`))
        })

        const finalMessage = await stream.finalMessage()

        console.log(`[canvas-ai-chat] tokens — input: ${finalMessage.usage.input_tokens}, output: ${finalMessage.usage.output_tokens}`)

        // Check for tool calls
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name: block.name, input: block.input })}\n\n`))
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        controller.close()
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Stream failed'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Multi-turn chat request
    if (body.messages && Array.isArray(body.messages)) {
      return handleChatStream(body as CanvasAIChatRequest)
    }

    // Legacy single-shot request
    return handleSingleShot(body as CanvasAIRequest)
  } catch (error) {
    console.error('Canvas AI error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Canvas AI failed' },
      { status: 500 }
    )
  }
}
