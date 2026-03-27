// Canvas AI tool executor — maps Claude tool calls to tldraw editor operations.
// Each tool function takes the editor + params, mutates the canvas, returns a status message.

import { Editor, TLImageShape, TLShapeId, createShapeId } from 'tldraw'
import type { ChatMessage, SSEEvent, CanvasAIToolCall } from '@/types/canvas-ai'
import type { AITextShape } from '@/components/canvas/AITextShape'

const BOARD_PADDING = 24
const IMAGE_GAP = 12
const ROW_HEIGHT = 250
const MAX_ROW_WIDTH = 900
const AI_TEXT_OFFSET = 24
const VIEWPORT_PADDING = 24

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getAIPlacement(
  editor: Editor,
  width: number,
  height: number,
  position: 'near_selection' | { x: number; y: number }
): { x: number; y: number } {
  if (position !== 'near_selection') {
    return position
  }

  const viewport = editor.getViewportPageBounds()
  const selection = editor.getSelectionPageBounds()
  const selectedShapes = editor.getSelectedShapes()

  if (!selection) {
    return {
      x: clamp(viewport.midX - width / 2, viewport.minX + VIEWPORT_PADDING, viewport.maxX - width - VIEWPORT_PADDING),
      y: clamp(viewport.midY - height / 2, viewport.minY + VIEWPORT_PADDING, viewport.maxY - height - VIEWPORT_PADDING),
    }
  }

  let anchorBounds = selection
  const selectedFrames = selectedShapes.filter((shape) => shape.type === 'frame')

  if (selectedFrames.length === 1) {
    anchorBounds = editor.getShapePageBounds(selectedFrames[0]) ?? selection
  } else if (selectedFrames.length === 0 && selectedShapes.length > 0) {
    const parentFrameIds = [...new Set(
      selectedShapes
        .map((shape) => editor.getShape(shape.parentId as TLShapeId))
        .filter((parent): parent is Exclude<typeof parent, null | undefined> => Boolean(parent && parent.type === 'frame'))
        .map((frame) => frame.id as TLShapeId)
    )]

    if (parentFrameIds.length === 1) {
      anchorBounds = editor.getShapePageBounds(parentFrameIds[0]) ?? selection
    }
  }

  const preferredRightX = anchorBounds.maxX + AI_TEXT_OFFSET
  const preferredLeftX = anchorBounds.minX - width - AI_TEXT_OFFSET
  const preferredY = anchorBounds.minY

  const fitsRight = preferredRightX + width <= viewport.maxX - VIEWPORT_PADDING
  const fitsLeft = preferredLeftX >= viewport.minX + VIEWPORT_PADDING

  let x: number
  if (fitsRight) {
    x = preferredRightX
  } else if (fitsLeft) {
    x = preferredLeftX
  } else {
    const selectionAnchorX = anchorBounds.midX - width / 2
    x = clamp(
      selectionAnchorX,
      viewport.minX + VIEWPORT_PADDING,
      viewport.maxX - width - VIEWPORT_PADDING
    )
  }

  const y = clamp(
    preferredY,
    viewport.minY + VIEWPORT_PADDING,
    viewport.maxY - height - VIEWPORT_PADDING
  )

  return { x, y }
}

interface ExecutionResult {
  success: boolean
  message: string
  /** If true, the AI Action Bar should trigger DNA extraction on the selected board */
  triggerExtractDna?: boolean
  /** If true, show a delete confirmation prompt */
  needsDeleteConfirmation?: boolean
}

export async function executeToolCalls(
  editor: Editor,
  toolCalls: CanvasAIToolCall[],
  canvasId: string
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = []

  for (const call of toolCalls) {
    const result = await executeOne(editor, call, canvasId)
    results.push(result)
  }

  return results
}

async function executeOne(
  editor: Editor,
  call: CanvasAIToolCall,
  canvasId: string
): Promise<ExecutionResult> {
  switch (call.name) {
    case 'place_text':
      return executePlaceText(editor, call.input as { text: string; position: string | { x: number; y: number } })

    case 'group_images':
      return executeGroupImages(editor, call.input as { name: string }, canvasId)

    case 'rename_board':
      return executeRenameBoard(editor, call.input as { newName: string }, canvasId)

    case 'delete_selection':
      return { success: true, message: 'Confirm deletion?', needsDeleteConfirmation: true }

    case 'analyze_selection':
      // analyze_selection is handled by Claude's response — it returns text via place_text
      return { success: true, message: 'Analysis complete' }

    case 'extract_dna':
      return { success: true, message: 'Opening DNA extraction...', triggerExtractDna: true }

    default:
      return { success: false, message: `Unknown tool: ${call.name}` }
  }
}

function executePlaceText(
  editor: Editor,
  params: { text: string; position: string | { x: number; y: number } }
): ExecutionResult {
  // Estimate height from text length (rough: 20px per line, ~50 chars per line at 320w)
  const width = 320
  const estimatedLines = Math.max(1, Math.ceil(params.text.length / 50))
  const estimatedHeight = estimatedLines * 20 + 24
  const placement =
    params.position === 'near_selection'
      ? 'near_selection'
      : (params.position as { x: number; y: number })
  const { x, y } = getAIPlacement(editor, width, estimatedHeight, placement)

  const shapeId = createShapeId()
  editor.createShape({
    id: shapeId,
    type: 'ai-text',
    x,
    y,
    props: {
      w: width,
      h: estimatedHeight,
      text: params.text,
      messages: '[]',
      selectionContext: '{}',
      title: '',
      canvasId: '',
      mode: 'simple',
      status: 'idle',
    },
  })

  return { success: true, message: 'Text placed on canvas' }
}

async function executeGroupImages(
  editor: Editor,
  params: { name: string },
  canvasId: string
): Promise<ExecutionResult> {
  const selected = editor.getSelectedShapes()
  const images = selected.filter((s): s is TLImageShape => {
    if (s.type !== 'image') return false
    const parent = editor.getShape(s.parentId as TLShapeId)
    return !parent || parent.type !== 'frame'
  })

  if (images.length === 0) {
    return { success: false, message: 'No ungrouped images selected' }
  }

  // Scale images to consistent row height
  const scaled = images.map((img) => {
    const aspect = img.props.w / (img.props.h || 1)
    const w = Math.round(ROW_HEIGHT * aspect)
    return { img, w, h: ROW_HEIGHT }
  })

  // Pack into rows
  const rows: typeof scaled[] = []
  let currentRow: typeof scaled = []
  let currentRowWidth = 0

  for (const item of scaled) {
    const itemTotalWidth = currentRow.length > 0 ? IMAGE_GAP + item.w : item.w
    if (currentRowWidth + itemTotalWidth > MAX_ROW_WIDTH && currentRow.length > 0) {
      rows.push(currentRow)
      currentRow = [item]
      currentRowWidth = item.w
    } else {
      currentRow.push(item)
      currentRowWidth += itemTotalWidth
    }
  }
  if (currentRow.length > 0) rows.push(currentRow)

  // Calculate frame size
  const rowWidths = rows.map((row) =>
    row.reduce((sum, item) => sum + item.w, 0) + (row.length - 1) * IMAGE_GAP
  )
  const maxRowWidth = Math.max(...rowWidths)
  const totalHeight = rows.length * ROW_HEIGHT + (rows.length - 1) * IMAGE_GAP
  const frameW = maxRowWidth + BOARD_PADDING * 2
  const frameH = totalHeight + BOARD_PADDING * 2 + 40

  // Position at center of selected images
  const avgX = images.reduce((sum, img) => sum + img.x, 0) / images.length
  const avgY = images.reduce((sum, img) => sum + img.y, 0) / images.length

  const frameId = createShapeId()
  let boardId = ''
  try {
    const response = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: params.name, canvasId, frameShapeId: frameId }),
    })

    if (response.ok) {
      const data = await response.json()
      boardId = data.id || ''
    }
  } catch {}

  editor.run(() => {
    editor.createShape({
      id: frameId,
      type: 'frame',
      x: avgX - frameW / 2,
      y: avgY - frameH / 2,
      meta: boardId ? { boardId } : {},
      props: { w: frameW, h: frameH, name: params.name },
    })

    let rowY = BOARD_PADDING + 40
    for (const row of rows) {
      let x = BOARD_PADDING
      for (const item of row) {
        editor.updateShape({
          id: item.img.id as TLShapeId,
          type: 'image',
          parentId: frameId,
          x,
          y: rowY,
          props: { ...item.img.props, w: item.w, h: item.h },
        })
        x += item.w + IMAGE_GAP
      }
      rowY += ROW_HEIGHT + IMAGE_GAP
    }
  })

  editor.select(frameId)

  return { success: true, message: `Grouped ${images.length} images into "${params.name}"` }
}

async function executeRenameBoard(
  editor: Editor,
  params: { newName: string },
  canvasId: string
): Promise<ExecutionResult> {
  const selected = editor.getSelectedShapes()
  const frame = selected.find((s) => s.type === 'frame')

  if (!frame) {
    return { success: false, message: 'No board selected' }
  }

  const oldName = (frame.props as { name?: string }).name
  const boardId = (frame.meta as { boardId?: string } | undefined)?.boardId
  if (!oldName && !boardId) {
    return { success: false, message: 'Selected board has no name' }
  }

  const response = await fetch('/api/boards', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canvasId,
      boardId,
      oldName,
      newName: params.newName,
    }),
  })

  if (!response.ok) {
    return { success: false, message: `Failed to rename "${oldName}"` }
  }

  editor.updateShape({
    id: frame.id as TLShapeId,
    type: 'frame',
    props: { name: params.newName },
  })

  return { success: true, message: `Renamed to "${params.newName}"` }
}

/**
 * Create an ai-text shape immediately with an empty assistant message.
 * Returns the shape ID for streaming updates.
 */
export function createAIShape(
  editor: Editor,
  position: 'near_selection' | { x: number; y: number },
  selectionContext: string,
  canvasId: string,
  boardId = ''
): TLShapeId {
  const width = 360
  const height = 40
  const { x, y } = getAIPlacement(editor, width, height, position)
  const shapeId = createShapeId()
  const initialMessage: ChatMessage[] = [
    { role: 'assistant', text: '', timestamp: Date.now() },
  ]

  editor.createShape({
    id: shapeId,
    type: 'ai-text',
    x,
    y,
    props: {
      w: width,
      h: height,
      text: '',
      messages: JSON.stringify(initialMessage),
      selectionContext,
      title: '',
      canvasId,
      boardId,
      mode: 'simple',
      status: 'waiting',
    },
  })

  return shapeId
}

/**
 * Stream an SSE response into a shape's messages prop.
 * Creates or updates the last assistant message with incoming text deltas.
 * Returns any tool calls received during the stream.
 */
export async function streamToShape(
  editor: Editor,
  shapeId: TLShapeId,
  stream: ReadableStream<Uint8Array>
): Promise<{ toolCalls: CanvasAIToolCall[] }> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const toolCalls: CanvasAIToolCall[] = []
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE events (separated by double newlines)
      const events = buffer.split('\n\n')
      buffer = events.pop() || '' // Keep incomplete event in buffer

      for (const event of events) {
        const line = event.trim()
        if (!line.startsWith('data: ')) continue

        try {
          const data: SSEEvent = JSON.parse(line.slice(6))

          if (data.type === 'text_delta') {
            // Update the last assistant message with the new text
            const shape = editor.getShape(shapeId) as AITextShape | undefined
            if (!shape) continue

            const messages: ChatMessage[] = JSON.parse(shape.props.messages)
            const lastMsg = messages[messages.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.text += data.text
              editor.updateShape({
                id: shapeId,
                type: 'ai-text',
                props: {
                  messages: JSON.stringify(messages),
                  status: shape.props.status === 'waiting' ? 'streaming' : shape.props.status,
                },
              })
            }
          } else if (data.type === 'tool_call') {
            toolCalls.push({ name: data.name, input: data.input })
          } else if (data.type === 'error') {
            console.error('[streamToShape] SSE error:', data.message)
            const shape = editor.getShape(shapeId) as AITextShape | undefined
            if (shape) {
              editor.updateShape({
                id: shapeId,
                type: 'ai-text',
                props: { status: 'idle' },
              })
            }
          } else if (data.type === 'done') {
            const shape = editor.getShape(shapeId) as AITextShape | undefined
            if (shape) {
              editor.updateShape({
                id: shapeId,
                type: 'ai-text',
                props: { status: 'idle' },
              })
            }
          }
        } catch {
          // Skip malformed events
        }
      }
    }
  } finally {
    const shape = editor.getShape(shapeId) as AITextShape | undefined
    if (shape && shape.props.status !== 'idle') {
      editor.updateShape({
        id: shapeId,
        type: 'ai-text',
        props: { status: 'idle' },
      })
    }
    reader.releaseLock()
  }

  return { toolCalls }
}
