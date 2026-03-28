// Build Canvas AI selection context from tldraw editor state.
// Reads selected shapes, classifies them, and builds the context object.

import { Editor, TLBookmarkAsset, TLImageShape, TLShape, TLShapeId } from 'tldraw'
import type { CanvasAISelectionContext } from '@/types/canvas-ai'
import { getBoardIdFromMeta } from './board-identity'

function getParentBoardInfo(editor: Editor, shape: TLShape) {
  const parent = editor.getShape(shape.parentId as TLShapeId)
  if (parent?.type !== 'frame') return {}

  return {
    boardName: (parent.props as { name?: string }).name,
    boardId: getBoardIdFromMeta(parent),
  }
}

function uniqueUrls(urls: Array<string | undefined | null>) {
  return [...new Set(urls.filter((url): url is string => !!url))]
}

export function buildSelectionContext(editor: Editor): CanvasAISelectionContext {
  const selected = editor.getSelectedShapes()
  const allShapes = editor.getCurrentPageShapes()

  // Classify selected shapes
  const images: TLImageShape[] = []
  const boards: TLShape[] = []
  const links: TLShape[] = []
  const otherShapes: TLShape[] = []

  for (const shape of selected) {
    if (shape.type === 'image') {
      images.push(shape as TLImageShape)
    } else if (shape.type === 'frame') {
      boards.push(shape)
    } else if (shape.type === 'bookmark' || shape.type === 'embed') {
      links.push(shape)
    } else {
      otherShapes.push(shape)
    }
  }

  // Determine selection type
  let selectionType: CanvasAISelectionContext['selectionType']
  if (images.length > 0 && (boards.length > 0 || links.length > 0)) {
    selectionType = 'mixed'
  } else if (images.length > 0) {
    selectionType = 'image'
  } else if (boards.length > 0) {
    selectionType = 'board'
  } else if (links.length > 0 || otherShapes.length > 0) {
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

  if (links.length > 0) {
    const linkDetails: NonNullable<CanvasAISelectionContext['selectedLinks']>['links'] = links.map((shape) => {
      const props = shape.props as { url?: string; assetId?: string | null }
      const asset =
        shape.type === 'bookmark' && props.assetId
          ? (editor.getAsset(props.assetId as Parameters<Editor['getAsset']>[0]) as TLBookmarkAsset | undefined)
          : undefined
      const boardInfo = getParentBoardInfo(editor, shape)

      return {
        url: props.url || '',
        title: asset?.props.title || undefined,
        description: asset?.props.description || undefined,
        previewImageUrl: asset?.props.image || undefined,
        boardId: boardInfo.boardId,
        boardName: boardInfo.boardName,
        shapeType: shape.type as 'bookmark' | 'embed',
      }
    })

    context.selectedLinks = {
      urls: uniqueUrls(linkDetails.map((link) => link.url)),
      links: linkDetails.filter((link) => link.url),
    }

    const previewUrls = uniqueUrls(linkDetails.map((link) => link.previewImageUrl))
    if (previewUrls.length > 0) {
      context.selectedImages = {
        urls: uniqueUrls([...(context.selectedImages?.urls || []), ...previewUrls]),
        ungrouped: context.selectedImages?.ungrouped ?? true,
        boardId:
          context.selectedImages?.boardId ||
          (linkDetails.length === 1 ? linkDetails[0].boardId : undefined),
        boardName:
          context.selectedImages?.boardName ||
          (linkDetails.length === 1 ? linkDetails[0].boardName : undefined),
      }
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

  if (links.length > 0 || otherShapes.length > 0) {
    const shapeTypes = [...new Set([...links, ...otherShapes].map((shape) => shape.type))].sort()
    context.selectedShapes = {
      count: links.length + otherShapes.length,
      shapeTypes,
    }
  }

  return context
}
