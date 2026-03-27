// Build Canvas AI selection context from tldraw editor state.
// Reads selected shapes, classifies them, and builds the context object.

import { Editor, TLImageShape, TLShape, TLShapeId } from 'tldraw'
import type { CanvasAISelectionContext } from '@/types/canvas-ai'
import { getBoardIdFromMeta } from './board-identity'

export function buildSelectionContext(editor: Editor): CanvasAISelectionContext {
  const selected = editor.getSelectedShapes()
  const allShapes = editor.getCurrentPageShapes()

  // Classify selected shapes
  const images: TLImageShape[] = []
  const boards: TLShape[] = []
  const otherShapes: TLShape[] = []

  for (const shape of selected) {
    if (shape.type === 'image') {
      images.push(shape as TLImageShape)
    } else if (shape.type === 'frame') {
      boards.push(shape)
    } else {
      otherShapes.push(shape)
    }
  }

  // Determine selection type
  let selectionType: CanvasAISelectionContext['selectionType']
  if (images.length > 0 && boards.length > 0) {
    selectionType = 'mixed'
  } else if (images.length > 0) {
    selectionType = 'image'
  } else if (boards.length > 0) {
    selectionType = 'board'
  } else if (otherShapes.length > 0) {
    selectionType = 'shapes'
  } else {
    selectionType = 'none'
  }

  // Build canvas overview
  const allBoards = allShapes.filter((s) => s.type === 'frame')
  const allImages = allShapes.filter((s) => s.type === 'image')
  const ungroupedImages = allImages.filter((s) => {
    const parent = editor.getShape(s.parentId as TLShapeId)
    return !parent || parent.type !== 'frame'
  })

  const canvasOverview = {
    totalBoards: allBoards.length,
    totalUngroupedImages: ungroupedImages.length,
    boardNames: allBoards.map((b) => (b.props as { name?: string }).name || 'Untitled'),
  }

  const context: CanvasAISelectionContext = { selectionType, canvasOverview }

  // Add image details if images are selected
  if (images.length > 0) {
    const urls: string[] = []
    let allUngrouped = true
    let boardName: string | undefined
    let boardId: string | undefined

    for (const img of images) {
      const asset = img.props.assetId ? editor.getAsset(img.props.assetId) : null
      const src = (asset?.props as { src?: string })?.src
      if (src) urls.push(src)

      const parent = editor.getShape(img.parentId as TLShapeId)
      if (parent?.type === 'frame') {
        allUngrouped = false
        boardName = (parent.props as { name?: string }).name
        boardId = getBoardIdFromMeta(parent)
      }
    }

    context.selectedImages = {
      urls,
      ungrouped: allUngrouped,
      boardName,
      boardId,
    }
  }

  // Add board details if boards are selected
  if (boards.length > 0) {
    const boardDetails = boards.map((board) => {
      const imageUrls: string[] = []
      const children = editor.getSortedChildIdsForParent(board.id)

      for (const childId of children) {
        const child = editor.getShape(childId)
        if (child?.type === 'image') {
          const img = child as TLImageShape
          const asset = img.props.assetId ? editor.getAsset(img.props.assetId) : null
          const src = (asset?.props as { src?: string })?.src
          if (src) imageUrls.push(src)
        }
      }

      return {
        id: getBoardIdFromMeta(board),
        name: (board.props as { name?: string }).name || 'Untitled',
        imageCount: imageUrls.length,
        imageUrls,
      }
    })

    context.selectedBoards = {
      names: boardDetails.map((board) => board.name),
      boards: boardDetails,
    }

    // If no direct images selected but boards have images, include them for vision
    const combinedBoardImageUrls = boardDetails.flatMap((board) => board.imageUrls)
    if (!context.selectedImages && combinedBoardImageUrls.length > 0) {
      context.selectedImages = {
        urls: combinedBoardImageUrls,
        ungrouped: false,
        boardId: boards.length === 1 ? getBoardIdFromMeta(boards[0]) : undefined,
        boardName: boards.length === 1
          ? (boards[0].props as { name?: string }).name
          : undefined,
      }
    }
  }

  return context
}
