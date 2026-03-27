'use client'

// Canvas UI layer — lives inside <Tldraw> context.
// Manages DNA panel visibility based on frame selection.
// Reference: grain-prd.md Section 11.3

import { useState, useEffect, useCallback } from 'react'
import { useEditor, useValue, TLShapeId } from 'tldraw'
import { RotateCcw } from 'lucide-react'
import { AIActionBar } from './AIActionBar'
import { GrainSelectionToolbar } from './GrainSelectionToolbar'
import { DNAPanelV2 } from '../dna/DNAPanelV2'
import { useTheme } from '@/context/ThemeContext'
import { applyBoardLinkToShape, findContainingBoardFrame, getBoardIdFromMeta } from '@/lib/board-identity'

interface ActiveBoard {
  boardId?: string
  boardName: string
  frameShapeId: TLShapeId
}

interface CanvasUIProps {
  canvasId: string
}

export function CanvasUI({ canvasId }: CanvasUIProps) {
  const editor = useEditor()
  const { isDefaultTheme, resetTheme } = useTheme()
  const [activeBoard, setActiveBoard] = useState<ActiveBoard | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const [toolbarAI, setToolbarAI] = useState(false)
  const [aiBarVisible, setAiBarVisible] = useState(false)
  const [revertAnchor, setRevertAnchor] = useState<{ left: number; top: number } | null>(null)
  const [lastBoardName, setLastBoardName] = useState<string | null>(null)

  // Wire the AI button callbacks (image toolbar, context menu, selection toolbar)
  useEffect(() => {
    const handleAskAI = () => setToolbarAI(true)
    window.addEventListener('grain:ask-ai', handleAskAI)
    return () => window.removeEventListener('grain:ask-ai', handleAskAI)
  }, [])

  useEffect(() => {
    const shouldLinkShape = (shapeId: TLShapeId) => {
      const shape = editor.getShape(shapeId)
      if (!shape || shape.type === 'frame') return

      const containingFrame = findContainingBoardFrame(editor, shape)
      if (!containingFrame) return

      const boardId = getBoardIdFromMeta(containingFrame)
      if (!boardId) return

      applyBoardLinkToShape(editor, shape, boardId)
    }

    const removeCreate = editor.sideEffects.registerAfterCreateHandler('shape', (shape, source) => {
      if (source !== 'user') return
      shouldLinkShape(shape.id)
    })

    const removeChange = editor.sideEffects.registerAfterChangeHandler('shape', (_prev, next, source) => {
      if (source !== 'user') return
      shouldLinkShape(next.id)
    })

    return () => {
      removeCreate()
      removeChange()
    }
  }, [editor])

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

  const handleAskAI = useCallback(() => setToolbarAI(true), [])

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
      {!aiBarVisible && <GrainSelectionToolbar onAskAI={handleAskAI} />}
      <AIActionBar
        canvasId={canvasId}
        onExtractDna={handleExtractDna}
        forceExpanded={toolbarAI}
        onForceExpandedConsumed={() => setToolbarAI(false)}
        onVisibilityChange={setAiBarVisible}
      />
      {boardToRender && (
        <div style={{ display: panelVisible ? 'contents' : 'none' }}>
          <DNAPanelV2
            boardName={boardToRender}
            boardId={activeBoard?.boardId}
            frameShapeId={activeBoard?.frameShapeId}
            canvasId={canvasId}
            onClose={() => setPanelVisible(false)}
          />
        </div>
      )}
    </>
  )
}
