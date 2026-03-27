'use client'

// Client-side Organize flow:
// 1. Collect ungrouped images from tldraw canvas
// 2. Send to /api/organize for Claude Vision analysis
// 3. Create frames (boards) on canvas and group images into them
// 4. Save board DNA to Supabase
// Reference: grain-prd.md Section 5.3

import { Editor, TLImageShape, TLShapeId, createShapeId } from 'tldraw'
import { CanvasImage } from '@/types/dna'

interface OrganizeAPIResult {
  boards: { board_name: string; image_ids: string[] }[]
}

const BOARD_PADDING = 24
const IMAGE_GAP = 12
const ROW_HEIGHT = 250
const MAX_ROW_WIDTH = 900

export function getUngroupedImages(editor: Editor): TLImageShape[] {
  // Get all image shapes that are NOT inside a frame (ungrouped)
  const allShapes = editor.getCurrentPageShapes()
  return allShapes.filter((shape): shape is TLImageShape => {
    if (shape.type !== 'image') return false
    // Check if this image is a child of a frame
    const parent = shape.parentId
    const parentShape = editor.getShape(parent as TLShapeId)
    return !parentShape || parentShape.type !== 'frame'
  })
}

export async function organizeImages(
  editor: Editor,
  canvasId: string
): Promise<OrganizeAPIResult | null> {
  const ungrouped = getUngroupedImages(editor)

  if (ungrouped.length === 0) return null

  // Build image references for the API
  const images: CanvasImage[] = ungrouped.map((shape) => {
    const asset = shape.props.assetId
      ? editor.getAsset(shape.props.assetId)
      : null
    return {
      id: shape.id,
      url: (asset?.props as { src?: string })?.src || '',
      position_x: shape.x,
      position_y: shape.y,
    }
  })

  // Call organize API
  const response = await fetch('/api/organize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, canvasId }),
    signal: AbortSignal.timeout(45000), // 45s timeout per PRD
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Organize failed')
  }

  const result: OrganizeAPIResult = await response.json()

  for (const board of result.boards) {
    const boardImages = board.image_ids
      .map((id) => ungrouped.find((s) => s.id === id))
      .filter(Boolean) as TLImageShape[]

    if (boardImages.length === 0) continue

    const avgX =
      boardImages.reduce((sum, img) => sum + img.x, 0) / boardImages.length
    const avgY =
      boardImages.reduce((sum, img) => sum + img.y, 0) / boardImages.length

    const scaled = boardImages.map((img) => {
      const aspect = img.props.w / (img.props.h || 1)
      const w = Math.round(ROW_HEIGHT * aspect)
      return { img, w, h: ROW_HEIGHT }
    })

    const imageRows: typeof scaled[] = []
    let currentRow: typeof scaled = []
    let currentRowWidth = 0

    for (const item of scaled) {
      const itemTotalWidth = currentRow.length > 0 ? IMAGE_GAP + item.w : item.w
      if (currentRowWidth + itemTotalWidth > MAX_ROW_WIDTH && currentRow.length > 0) {
        imageRows.push(currentRow)
        currentRow = [item]
        currentRowWidth = item.w
      } else {
        currentRow.push(item)
        currentRowWidth += itemTotalWidth
      }
    }
    if (currentRow.length > 0) imageRows.push(currentRow)

    const rowWidths = imageRows.map((row) =>
      row.reduce((sum, item) => sum + item.w, 0) + (row.length - 1) * IMAGE_GAP
    )
    const maxRowWidth = Math.max(...rowWidths)
    const totalHeight = imageRows.length * ROW_HEIGHT + (imageRows.length - 1) * IMAGE_GAP
    const frameW = maxRowWidth + BOARD_PADDING * 2
    const frameH = totalHeight + BOARD_PADDING * 2 + 40

    const frameId = createShapeId()
    const createBoardResponse = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: board.board_name, canvasId, frameShapeId: frameId }),
    })

    if (!createBoardResponse.ok) {
      throw new Error('Failed to create board record')
    }

    const { id: boardId } = await createBoardResponse.json()

    editor.run(() => {
      editor.createShape({
        id: frameId,
        type: 'frame',
        x: avgX - frameW / 2,
        y: avgY - frameH / 2,
        meta: { boardId },
        props: {
          w: frameW,
          h: frameH,
          name: board.board_name,
        },
      })

      let rowY = BOARD_PADDING + 40
      for (const row of imageRows) {
        let x = BOARD_PADDING
        for (const item of row) {
          editor.updateShape({
            id: item.img.id as TLShapeId,
            type: 'image',
            parentId: frameId,
            x,
            y: rowY,
            props: {
              ...item.img.props,
              w: item.w,
              h: item.h,
            },
          })
          x += item.w + IMAGE_GAP
        }
        rowY += ROW_HEIGHT + IMAGE_GAP
      }
    })
  }

  return result
}
