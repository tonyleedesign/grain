'use client'

import { useEffect, useRef } from 'react'
import { Editor, TLShapeId } from 'tldraw'
import {
  applyBoardLinkToShape,
  clearBoardLinkFromShape,
  findContainingBoardFrame,
  getBoardIdFromMeta,
  hasLiveBoardFrame,
} from '@/lib/board-identity'

export function useBoardIdentity(
  editor: Editor,
  canvasId: string,
  getAuthHeaders?: () => Promise<Record<string, string> | null>
) {
  const relinkingFramesRef = useRef(new Set<string>())

  useEffect(() => {
    const syncFrameBoardChildren = (frameId: TLShapeId, boardId: string) => {
      const childIds = editor.getSortedChildIdsForParent(frameId)
      for (const childId of childIds) {
        const child = editor.getShape(childId as TLShapeId)
        if (!child) continue
        applyBoardLinkToShape(editor, child, boardId)
      }
    }

    const ensureFrameBoardIdentity = async (shapeId: TLShapeId) => {
      const frame = editor.getShape(shapeId)
      if (!frame || frame.type !== 'frame') return

      const boardId = getBoardIdFromMeta(frame)
      const boardName = ((frame.props as { name?: string }).name || '').trim()
      if (!boardId || !boardName || relinkingFramesRef.current.has(shapeId)) return

      relinkingFramesRef.current.add(shapeId)

      try {
        const authHeaders = getAuthHeaders ? await getAuthHeaders() : null
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (authHeaders) Object.assign(headers, authHeaders)

        const boardResponse = await fetch(
          `/api/boards?${new URLSearchParams({ boardId, canvasId }).toString()}`,
          { headers }
        )

        if (boardResponse.ok) {
          const boardData = (await boardResponse.json()) as { id?: string; frame_shape_id?: string | null }
          if (boardData.id === boardId && boardData.frame_shape_id === frame.id) {
            syncFrameBoardChildren(frame.id, boardId)
            return
          }
        }

        const cloneResponse = await fetch('/api/boards/clone', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sourceBoardId: boardId,
            canvasId,
            frameShapeId: frame.id,
            name: boardName,
          }),
        })

        if (!cloneResponse.ok) return

        const cloneData = (await cloneResponse.json()) as { id?: string }
        if (!cloneData.id) return

        editor.updateShape({
          id: frame.id,
          type: 'frame',
          meta: { ...(frame.meta || {}), boardId: cloneData.id },
        })

        syncFrameBoardChildren(frame.id, cloneData.id)
      } finally {
        relinkingFramesRef.current.delete(shapeId)
      }
    }

    const shouldLinkShape = (shapeId: TLShapeId, mode: 'create' | 'change') => {
      const shape = editor.getShape(shapeId)
      if (!shape) return

      if (shape.type === 'frame') {
        void ensureFrameBoardIdentity(shape.id)
        return
      }

      const containingFrame = findContainingBoardFrame(editor, shape)
      if (!containingFrame) {
        const staleBoardId = getBoardIdFromMeta(shape)
        if (staleBoardId && mode === 'create') {
          clearBoardLinkFromShape(editor, shape)
          return
        }

        if (staleBoardId && !hasLiveBoardFrame(editor, staleBoardId)) {
          clearBoardLinkFromShape(editor, shape)
        }
        return
      }

      const boardId = getBoardIdFromMeta(containingFrame)
      if (!boardId) return

      applyBoardLinkToShape(editor, shape, boardId)
    }

    const removeCreate = editor.sideEffects.registerAfterCreateHandler('shape', (shape, source) => {
      if (source !== 'user') return
      shouldLinkShape(shape.id, 'create')
    })

    const removeChange = editor.sideEffects.registerAfterChangeHandler('shape', (_prev, next, source) => {
      if (source !== 'user') return
      shouldLinkShape(next.id, 'change')
    })

    return () => {
      removeCreate()
      removeChange()
    }
  }, [canvasId, editor, getAuthHeaders])
}
