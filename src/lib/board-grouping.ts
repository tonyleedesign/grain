import { Editor, TLShape, TLShapeId, createShapeId } from 'tldraw'

const BOARD_PADDING = 24
const ITEM_GAP = 12
const HEADER_HEIGHT = 40
const MAX_ROW_WIDTH = 900
const TARGET_IMAGE_HEIGHT = 250
const MAX_LINK_WIDTH = 320
const MAX_LINK_HEIGHT = 220

export function isManuallyGroupableShape(editor: Editor, shape: TLShape) {
  if (shape.type !== 'image' && shape.type !== 'bookmark' && shape.type !== 'embed') {
    return false
  }

  const parentShape = editor.getShape(shape.parentId as TLShapeId)
  return !parentShape || parentShape.type !== 'frame'
}

async function createBoardRecord(canvasId: string, boardName: string, frameShapeId: string) {
  const response = await fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: boardName, canvasId, frameShapeId }),
  })

  if (!response.ok) {
    throw new Error('Failed to create board record')
  }

  return response.json() as Promise<{ id: string }>
}

function getShapeLayoutDimensions(editor: Editor, shape: TLShape) {
  const bounds = editor.getShapePageBounds(shape)
  const width = Math.max(1, Math.round(bounds?.width ?? 240))
  const height = Math.max(1, Math.round(bounds?.height ?? 180))

  if (shape.type === 'image') {
    const aspect = width / Math.max(height, 1)
    return {
      width: Math.max(120, Math.round(TARGET_IMAGE_HEIGHT * aspect)),
      height: TARGET_IMAGE_HEIGHT,
    }
  }

  const scale = Math.min(MAX_LINK_WIDTH / width, MAX_LINK_HEIGHT / height, 1)
  return {
    width: Math.max(180, Math.round(width * scale)),
    height: Math.max(120, Math.round(height * scale)),
  }
}

export async function groupShapesIntoBoard(
  editor: Editor,
  canvasId: string,
  shapes: TLShape[],
  boardName = 'Untitled Board'
) {
  const artifacts = shapes.filter((shape) => isManuallyGroupableShape(editor, shape))
  if (!artifacts.length) return null

  const avgX = artifacts.reduce((sum, shape) => sum + shape.x, 0) / artifacts.length
  const avgY = artifacts.reduce((sum, shape) => sum + shape.y, 0) / artifacts.length
  const laidOut = artifacts.map((shape) => ({
    shape,
    ...getShapeLayoutDimensions(editor, shape),
  }))

  const rows: typeof laidOut[] = []
  let currentRow: typeof laidOut = []
  let currentRowWidth = 0

  for (const item of laidOut) {
    const nextWidth = currentRow.length > 0 ? currentRowWidth + ITEM_GAP + item.width : item.width
    if (nextWidth > MAX_ROW_WIDTH && currentRow.length > 0) {
      rows.push(currentRow)
      currentRow = [item]
      currentRowWidth = item.width
    } else {
      currentRow.push(item)
      currentRowWidth = nextWidth
    }
  }

  if (currentRow.length > 0) rows.push(currentRow)

  const rowWidths = rows.map((row) => row.reduce((sum, item) => sum + item.width, 0) + (row.length - 1) * ITEM_GAP)
  const rowHeights = rows.map((row) => Math.max(...row.map((item) => item.height)))
  const frameW = Math.max(...rowWidths, 240) + BOARD_PADDING * 2
  const frameH =
    rowHeights.reduce((sum, height) => sum + height, 0) +
    (rows.length - 1) * ITEM_GAP +
    BOARD_PADDING * 2 +
    HEADER_HEIGHT

  const frameId = createShapeId()
  const { id: boardId } = await createBoardRecord(canvasId, boardName, frameId)

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
        name: boardName,
      },
    })

    let rowY = BOARD_PADDING + HEADER_HEIGHT
    rows.forEach((row, rowIndex) => {
      let x = BOARD_PADDING
      row.forEach((item) => {
        const baseUpdate = {
          id: item.shape.id,
          type: item.shape.type,
          parentId: frameId,
          x,
          y: rowY,
          meta: {
            ...(item.shape.meta || {}),
            boardId,
          },
        }

        if (item.shape.type === 'image') {
          editor.updateShape({
            ...baseUpdate,
            type: 'image',
            props: {
              ...item.shape.props,
              w: item.width,
              h: item.height,
            },
          })
        } else if (item.shape.type === 'bookmark') {
          editor.updateShape({
            ...baseUpdate,
            type: 'bookmark',
            props: {
              ...item.shape.props,
              w: item.width,
              h: item.height,
            },
          })
        } else if (item.shape.type === 'embed') {
          editor.updateShape({
            ...baseUpdate,
            type: 'embed',
            props: {
              ...item.shape.props,
              w: item.width,
              h: item.height,
            },
          })
        }

        x += item.width + ITEM_GAP
      })
      rowY += rowHeights[rowIndex] + ITEM_GAP
    })
  })

  editor.select(frameId)

  return { boardId, frameId, count: artifacts.length, boardName }
}
