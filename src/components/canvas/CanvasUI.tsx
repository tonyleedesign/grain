'use client'

// Canvas UI layer — lives inside <Tldraw> context.
// Manages DNA panel visibility based on frame selection.
// Reference: grain-prd.md Section 11.3

import { useState, useEffect, useRef, useCallback, MutableRefObject } from 'react'
import { useEditor, useValue } from 'tldraw'
import { RotateCcw } from 'lucide-react'
import { AIActionBar } from './AIActionBar'
import { GrainSelectionToolbar } from './GrainSelectionToolbar'
import { DNAPanelV2 } from '../dna/DNAPanelV2'
import { useTheme } from '@/context/ThemeContext'

interface CanvasUIProps {
  canvasId: string
  askAIRef: MutableRefObject<() => void>
}

export function CanvasUI({ canvasId, askAIRef }: CanvasUIProps) {
  const editor = useEditor()
  const { isDefaultTheme, resetTheme } = useTheme()
  const [activeBoardName, setActiveBoardName] = useState<string | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const [toolbarAI, setToolbarAI] = useState(false)
  const [aiBarVisible, setAiBarVisible] = useState(false)
  const [revertAnchor, setRevertAnchor] = useState<{ left: number; top: number } | null>(null)
  const lastBoardName = useRef<string | null>(null)

  // Wire the AI button callbacks (image toolbar, context menu, selection toolbar)
  useEffect(() => {
    askAIRef.current = () => setToolbarAI(true)
  }, [askAIRef])

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
        setActiveBoardName(name)
        lastBoardName.current = name
        setPanelVisible(true)
        return
      }
    }
    // Nothing selected — hide the panel but keep it mounted
    if (selectedShapes.length === 0) {
      setPanelVisible(false)
    }
  }, [selectedShapes])

  // Callback for AI to trigger DNA extraction
  const handleExtractDna = useCallback(() => {
    const selected = editor.getSelectedShapes()
    const frame = selected.find((s) => s.type === 'frame')
    if (frame) {
      const name = (frame.props as { name?: string }).name
      if (name) {
        setActiveBoardName(name)
        lastBoardName.current = name
        setPanelVisible(true)
      }
    }
  }, [editor])

  const handleAskAI = useCallback(() => setToolbarAI(true), [])

  const boardToRender = activeBoardName || lastBoardName.current

  useEffect(() => {
    if (isDefaultTheme) {
      setRevertAnchor(null)
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
            canvasId={canvasId}
            onClose={() => setPanelVisible(false)}
          />
        </div>
      )}
    </>
  )
}
