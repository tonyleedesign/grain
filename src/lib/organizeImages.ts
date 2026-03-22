'use client'

// Client-side Organize flow:
// 1. Collect ungrouped images from tldraw canvas
// 2. Send to /api/organize for Claude Vision analysis
// 3. Create frames (boards) on canvas and group images into them
// 4. Save board DNA to Supabase
// Reference: grain-prd.md Section 5.3

import { Editor, TLImageShape, TLShapeId, createShapeId } from 'tldraw'
import { CanvasImage, OrganizeResult } from '@/types/dna'

const BOARD_PADDING = 24
const IMAGE_GAP = 12
const IMAGES_PER_ROW = 3

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
): Promise<OrganizeResult | null> {
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

  const result: OrganizeResult = await response.json()

  // Create frames and group images on the canvas
  editor.run(() => {
    for (const board of result.boards) {
      // Find the images belonging to this board
      const boardImages = board.image_ids
        .map((id) => ungrouped.find((s) => s.id === id))
        .filter(Boolean) as TLImageShape[]

      if (boardImages.length === 0) continue

      // Calculate board position — center of where the images currently are
      const avgX =
        boardImages.reduce((sum, img) => sum + img.x, 0) / boardImages.length
      const avgY =
        boardImages.reduce((sum, img) => sum + img.y, 0) / boardImages.length

      // Calculate frame size based on image count
      const cols = Math.min(boardImages.length, IMAGES_PER_ROW)
      const rows = Math.ceil(boardImages.length / IMAGES_PER_ROW)
      const imgW = 200
      const imgH = 200
      const frameW = cols * imgW + (cols - 1) * IMAGE_GAP + BOARD_PADDING * 2
      const frameH =
        rows * imgH + (rows - 1) * IMAGE_GAP + BOARD_PADDING * 2 + 40 // +40 for header

      // Create the frame (board container)
      const frameId = createShapeId()
      editor.createShape({
        id: frameId,
        type: 'frame',
        x: avgX - frameW / 2,
        y: avgY - frameH / 2,
        props: {
          w: frameW,
          h: frameH,
          name: board.dna.board_name,
        },
      })

      // Move and arrange images inside the frame
      boardImages.forEach((img, index) => {
        const col = index % IMAGES_PER_ROW
        const row = Math.floor(index / IMAGES_PER_ROW)
        const x = BOARD_PADDING + col * (imgW + IMAGE_GAP)
        const y = BOARD_PADDING + 40 + row * (imgH + IMAGE_GAP) // +40 for header

        editor.updateShape({
          id: img.id as TLShapeId,
          type: 'image',
          parentId: frameId,
          x,
          y,
          props: {
            ...img.props,
            w: imgW,
            h: imgH,
          },
        })
      })
    }
  })

  return result
}
