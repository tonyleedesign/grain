import { Editor, TLFrameShape, TLShape, TLShapeId } from 'tldraw'
import type { JsonObject } from '@tldraw/utils'

interface ShapeMetaWithBoardId {
  boardId?: string
}

export interface BoardReference {
  boardId?: string
  boardName?: string
  frameId?: TLShapeId
}

export function getBoardIdFromMeta(shape: { meta?: Record<string, unknown> } | null | undefined): string | undefined {
  const boardId = (shape?.meta as ShapeMetaWithBoardId | undefined)?.boardId
  return typeof boardId === 'string' && boardId.trim() ? boardId : undefined
}

export function getBoardFrameForShape(editor: Editor, shape: TLShape | undefined): TLFrameShape | null {
  if (!shape) return null
  if (shape.type === 'frame') return shape as TLFrameShape

  const parent = editor.getShape(shape.parentId as TLShapeId)
  if (parent?.type === 'frame') return parent as TLFrameShape

  return null
}

export function getBoardReferenceForShape(editor: Editor, shape: TLShape | undefined): BoardReference | null {
  const frame = getBoardFrameForShape(editor, shape)
  if (!frame) return null

  return {
    boardId: getBoardIdFromMeta(frame),
    boardName: (frame.props as { name?: string }).name,
    frameId: frame.id as TLShapeId,
  }
}

export function getSelectionBoardReference(editor: Editor): BoardReference | null {
  const selected = editor.getSelectedShapes()
  if (selected.length === 0) return null

  for (const shape of selected) {
    const reference = getBoardReferenceForShape(editor, shape)
    if (reference) return reference
  }

  return null
}

export function findContainingBoardFrame(editor: Editor, shape: TLShape | undefined): TLFrameShape | null {
  if (!shape || shape.type === 'frame') return null

  const parentFrame = getBoardFrameForShape(editor, shape)
  if (parentFrame) return parentFrame

  const shapeBounds = editor.getShapePageBounds(shape)
  if (!shapeBounds) return null

  const center = shapeBounds.center
  const candidateFrames = editor
    .getCurrentPageShapes()
    .filter((candidate): candidate is TLFrameShape => {
      if (candidate.type !== 'frame' || candidate.id === shape.id) return false
      const frameBounds = editor.getShapePageBounds(candidate)
      return Boolean(
        frameBounds &&
          center.x >= frameBounds.minX &&
          center.x <= frameBounds.maxX &&
          center.y >= frameBounds.minY &&
          center.y <= frameBounds.maxY
      )
    })

  if (candidateFrames.length !== 1) return null
  return candidateFrames[0]
}

export function applyBoardLinkToShape(editor: Editor, shape: TLShape, boardId: string) {
  if (shape.type === 'ai-text' || shape.type === 'snapshot-card') {
    const props = shape.props as { boardId?: string }
    if (props.boardId === boardId) return

    editor.updateShape({
      id: shape.id,
      type: shape.type,
      props: {
        ...shape.props,
        boardId,
      },
    })
    return
  }

  const currentBoardId = getBoardIdFromMeta(shape)
  if (currentBoardId === boardId) return

  editor.updateShape({
    id: shape.id,
    type: shape.type,
    meta: {
      ...(shape.meta || {}),
      boardId,
    },
  })
}

export function clearBoardLinkFromShape(editor: Editor, shape: TLShape) {
  if (shape.type === 'ai-text' || shape.type === 'snapshot-card') {
    const props = shape.props as { boardId?: string }
    if (!props.boardId) return

    editor.updateShape({
      id: shape.id,
      type: shape.type,
      props: {
        ...shape.props,
        boardId: '',
      },
    })
    return
  }

  const currentBoardId = getBoardIdFromMeta(shape)
  if (!currentBoardId) return

  const nextMeta = { ...(shape.meta || {}) } as JsonObject
  delete nextMeta.boardId

  editor.updateShape({
    id: shape.id,
    type: shape.type,
    meta: nextMeta,
  })
}

export function hasLiveBoardFrame(editor: Editor, boardId: string) {
  return editor.getCurrentPageShapes().some((shape) => {
    if (shape.type !== 'frame') return false
    return getBoardIdFromMeta(shape) === boardId
  })
}
