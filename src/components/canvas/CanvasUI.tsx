'use client'

// Canvas UI layer — lives inside <Tldraw> context.
// Manages DNA panel visibility based on frame selection.
// Reference: grain-prd.md Section 11.3

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, useValue, TLShapeId } from 'tldraw'
import { RotateCcw } from 'lucide-react'
import { AIActionBar } from './AIActionBar'
import { GrainSelectionToolbar } from './GrainSelectionToolbar'
import { DNAPanelV2 } from '../dna/DNAPanelV2'
import { useTheme } from '@/context/ThemeContext'
import {
  applyBoardLinkToShape,
  clearBoardLinkFromShape,
  findContainingBoardFrame,
  getBoardIdFromMeta,
  hasLiveBoardFrame,
} from '@/lib/board-identity'
import { applyPendingCaptures } from '@/lib/capture-placement'
import type { PendingCapture } from '@/types/captures'

interface ActiveBoard {
  boardId?: string
  boardName: string
  frameShapeId: TLShapeId
}

interface CanvasUIProps {
  canvasId: string
  accessToken?: string | null
}

export function CanvasUI({ canvasId, accessToken }: CanvasUIProps) {
  const editor = useEditor()
  const { isDefaultTheme, resetTheme } = useTheme()
  const [activeBoard, setActiveBoard] = useState<ActiveBoard | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const [toolbarAI, setToolbarAI] = useState(false)
  const [toolbarAIAnchor, setToolbarAIAnchor] = useState<{ x: number; y: number } | null>(null)
  const [aiBarVisible, setAiBarVisible] = useState(false)
  const [revertAnchor, setRevertAnchor] = useState<{ left: number; top: number } | null>(null)
  const [lastBoardName, setLastBoardName] = useState<string | null>(null)
  const [dnaExtracting, setDnaExtracting] = useState(false)
  const isApplyingCapturesRef = useRef(false)
  const capturePollTimeoutRef = useRef<number | null>(null)
  const relinkingFramesRef = useRef(new Set<string>())

  // Wire the AI button callbacks (image toolbar, context menu, selection toolbar)
  useEffect(() => {
    const handleAskAI = (event: Event) => {
      const customEvent = event as CustomEvent<{ anchor?: { x: number; y: number } }>
      setToolbarAIAnchor(customEvent.detail?.anchor || null)
      setToolbarAI(true)
    }
    window.addEventListener('grain:ask-ai', handleAskAI)
    return () => window.removeEventListener('grain:ask-ai', handleAskAI)
  }, [])

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
        const boardResponse = await fetch(
          `/api/boards?${new URLSearchParams({ boardId, canvasId }).toString()}`
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
          headers: { 'Content-Type': 'application/json' },
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
      } catch {
        return
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
  }, [canvasId, editor])

  // Watch for selection changes reactively
  const selectedShapes = useValue(
    'selectedShapes',
    () => editor.getSelectedShapes(),
    [editor]
  )

  useEffect(() => {
    // If exactly one frame is selected, open its DNA panel
    if (selectedShapes.length === 1 && selectedShapes[0].type === 'frame') {
      const frame = selectedShapes[0]
      const name = (frame.props as { name?: string }).name
      if (name) {
        const animationFrame = window.requestAnimationFrame(() => {
          setActiveBoard({
            boardId: getBoardIdFromMeta(frame),
            boardName: name,
            frameShapeId: frame.id,
          })
          setLastBoardName(name)
          setPanelVisible(true)
        })
        return () => window.cancelAnimationFrame(animationFrame)
        return
      }
    }
    // Nothing selected — hide the panel but keep it mounted
    if (selectedShapes.length === 0) {
      const animationFrame = window.requestAnimationFrame(() => {
        setPanelVisible(false)
      })
      return () => window.cancelAnimationFrame(animationFrame)
    }
  }, [selectedShapes])

  // Callback for AI to trigger DNA extraction
  const handleExtractDna = useCallback(() => {
    const selected = editor.getSelectedShapes()
    const frame = selected.find((s) => s.type === 'frame')
    if (frame) {
      const name = (frame.props as { name?: string }).name
      if (name) {
        setActiveBoard({
          boardId: getBoardIdFromMeta(frame),
          boardName: name,
          frameShapeId: frame.id,
        })
        setLastBoardName(name)
        setPanelVisible(true)
      }
    }
  }, [editor])

  const handleAskAI = useCallback(() => {
    setToolbarAIAnchor(null)
    setToolbarAI(true)
  }, [])

  const boardToRender = activeBoard?.boardName || lastBoardName

  useEffect(() => {
    if (isDefaultTheme) {
      return
    }

    let frame = 0

    const updateAnchor = () => {
      const button = document.querySelector('.grain-organize-toolbar-button') as HTMLElement | null
      if (!button) {
        setRevertAnchor(null)
        return
      }

      const rect = button.getBoundingClientRect()
      setRevertAnchor({
        left: rect.left + rect.width / 2,
        top: rect.top - 8,
      })
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(updateAnchor)
    }

    scheduleUpdate()
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [isDefaultTheme])

  useEffect(() => {
    if (!accessToken) return

    let cancelled = false
    const FAST_POLL_MS = 1500
    const IDLE_POLL_MS = 4000

    const clearScheduledPoll = () => {
      if (capturePollTimeoutRef.current) {
        window.clearTimeout(capturePollTimeoutRef.current)
        capturePollTimeoutRef.current = null
      }
    }

    const scheduleNextPoll = (delay: number) => {
      clearScheduledPoll()

      if (cancelled) return

      capturePollTimeoutRef.current = window.setTimeout(() => {
        if (!cancelled && !document.hidden) {
          void loadPendingCaptures()
        }
      }, delay)
    }

    const loadPendingCaptures = async () => {
      if (isApplyingCapturesRef.current) return
      isApplyingCapturesRef.current = true
      let nextPollDelay = IDLE_POLL_MS

      try {
        const response = await fetch(`/api/send-to-grain/pending?canvasId=${canvasId}`, {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => '')
          console.error('Failed to fetch pending captures:', response.status, errorText)
          return
        }

        const data = (await response.json()) as { captures?: PendingCapture[] }
        const captures = data.captures || []
        console.info('[SendToGrain] pending captures fetched', {
          canvasId,
          count: captures.length,
          ids: captures.map((capture) => capture.id),
        })
        if (!captures.length || cancelled) return

        const appliedIds = await applyPendingCaptures(editor, captures)
        console.info('[SendToGrain] pending captures applied', {
          canvasId,
          appliedIds,
        })
        nextPollDelay = FAST_POLL_MS
        if (!appliedIds.length || cancelled) return

        const markAppliedResponse = await fetch('/api/send-to-grain/pending', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            canvasId,
            captureIds: appliedIds,
          }),
        })

        if (!markAppliedResponse.ok) {
          const errorText = await markAppliedResponse.text().catch(() => '')
          console.error('Failed to mark captures applied:', markAppliedResponse.status, errorText)
        }
      } catch (error) {
        console.error('Failed to apply pending captures:', error)
      } finally {
        isApplyingCapturesRef.current = false
        if (!cancelled && !document.hidden) {
          scheduleNextPoll(nextPollDelay)
        }
      }
    }

    void loadPendingCaptures()

    const triggerImmediateSync = () => {
      if (!cancelled && !document.hidden) {
        clearScheduledPoll()
        void loadPendingCaptures()
      }
    }

    window.addEventListener('focus', triggerImmediateSync)
    window.addEventListener('pageshow', triggerImmediateSync)
    window.addEventListener('online', triggerImmediateSync)
    document.addEventListener('visibilitychange', triggerImmediateSync)

    return () => {
      cancelled = true
      clearScheduledPoll()
      window.removeEventListener('focus', triggerImmediateSync)
      window.removeEventListener('pageshow', triggerImmediateSync)
      window.removeEventListener('online', triggerImmediateSync)
      document.removeEventListener('visibilitychange', triggerImmediateSync)
    }
  }, [accessToken, canvasId, editor])

  return (
    <>
      {!isDefaultTheme && (
        <button
          onClick={resetTheme}
          title="Revert theme"
          style={{
            position: 'fixed',
            left: revertAnchor?.left ?? '50%',
            top: revertAnchor?.top ?? 84,
            transform: 'translate(-50%, -100%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: '999px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            boxShadow: 'var(--shadow-toolbar)',
            fontFamily: 'var(--font-family)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={12} />
          Revert
        </button>
      )}
      {!aiBarVisible && <GrainSelectionToolbar canvasId={canvasId} onAskAI={handleAskAI} />}
      <AIActionBar
        canvasId={canvasId}
        onExtractDna={handleExtractDna}
        forceExpanded={toolbarAI}
        forceAnchor={toolbarAIAnchor}
        onForceExpandedConsumed={() => {
          setToolbarAI(false)
        }}
        onVisibilityChange={setAiBarVisible}
      />
      <BoardProcessingOverlay
        frameShapeId={activeBoard?.frameShapeId ?? null}
        active={dnaExtracting}
        label="Extracting DNA..."
      />
      {boardToRender && (
        <DNAPanelV2
          boardName={boardToRender}
          boardId={activeBoard?.boardId}
          frameShapeId={activeBoard?.frameShapeId}
          canvasId={canvasId}
          isOpen={panelVisible}
          onClose={() => setPanelVisible(false)}
          onExtractionStateChange={setDnaExtracting}
        />
      )}
    </>
  )
}

function BoardProcessingOverlay({
  frameShapeId,
  active,
  label,
}: {
  frameShapeId: TLShapeId | null
  active: boolean
  label: string
}) {
  const editor = useEditor()

  const overlayBounds = useValue(
    'boardProcessingOverlayBounds',
    () => {
      if (!active || !frameShapeId) return null

      const frame = editor.getShape(frameShapeId)
      if (!frame || frame.type !== 'frame') return null

      const bounds = editor.getShapePageBounds(frame)
      if (!bounds) return null

      const topLeft = editor.pageToViewport({ x: bounds.minX, y: bounds.minY })
      const bottomRight = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY })

      return {
        left: topLeft.x,
        top: topLeft.y,
        width: Math.max(0, bottomRight.x - topLeft.x),
        height: Math.max(0, bottomRight.y - topLeft.y),
      }
    },
    [active, editor, frameShapeId]
  )

  if (!overlayBounds) return null

  return (
    <div
      className="grain-board-processing-overlay"
      style={{
        left: overlayBounds.left,
        top: overlayBounds.top,
        width: overlayBounds.width,
        height: overlayBounds.height,
      }}
    >
      <div className="grain-board-processing-overlay__label">
        {label}
      </div>
    </div>
  )
}
