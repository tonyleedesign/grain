// Canvas AI tool executor — maps Claude tool calls to tldraw editor operations.
// Each tool function takes the editor + params, mutates the canvas, returns a status message.

import { Editor, TLImageShape, TLShapeId, createShapeId } from 'tldraw'
import type { CanvasAIToolCall } from '@/types/canvas-ai'

const BOARD_PADDING = 24
const IMAGE_GAP = 12
const ROW_HEIGHT = 250
const MAX_ROW_WIDTH = 900
const AI_TEXT_OFFSET_Y = 24

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
      return executeRenameBoard(editor, call.input as { newName: string })

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
  let x: number
  let y: number

  if (params.position === 'near_selection') {
    const bounds = editor.getSelectionPageBounds()
    if (bounds) {
      x = bounds.maxX + AI_TEXT_OFFSET_Y
      y = bounds.minY
    } else {
      // Fallback: center of viewport
      const viewport = editor.getViewportPageBounds()
      x = viewport.midX
      y = viewport.midY
    }
  } else {
    const pos = params.position as { x: number; y: number }
    x = pos.x
    y = pos.y
  }

  // Estimate height from text length (rough: 20px per line, ~50 chars per line at 320w)
  const estimatedLines = Math.max(1, Math.ceil(params.text.length / 50))
  const estimatedHeight = estimatedLines * 20 + 24

  const shapeId = createShapeId()
  editor.createShape({
    id: shapeId,
    type: 'ai-text',
    x,
    y,
    props: {
      w: 320,
      h: estimatedHeight,
      text: params.text,
    },
  })

  return { success: true, message: 'Text placed on canvas' }
}

function executeGroupImages(
  editor: Editor,
  params: { name: string },
  canvasId: string
): ExecutionResult {
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

  editor.run(() => {
    editor.createShape({
      id: frameId,
      type: 'frame',
      x: avgX - frameW / 2,
      y: avgY - frameH / 2,
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

  // Save board to Supabase (fire-and-forget)
  fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: params.name, canvasId }),
  }).catch((err) => console.error('Board save error:', err))

  editor.select(frameId)

  return { success: true, message: `Grouped ${images.length} images into "${params.name}"` }
}

function executeRenameBoard(
  editor: Editor,
  params: { newName: string }
): ExecutionResult {
  const selected = editor.getSelectedShapes()
  const frame = selected.find((s) => s.type === 'frame')

  if (!frame) {
    return { success: false, message: 'No board selected' }
  }

  editor.updateShape({
    id: frame.id as TLShapeId,
    type: 'frame',
    props: { ...(frame.props as unknown as Record<string, unknown>), name: params.newName },
  })

  return { success: true, message: `Renamed to "${params.newName}"` }
}
