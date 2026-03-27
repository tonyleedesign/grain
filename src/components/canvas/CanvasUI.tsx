'use client'

// Canvas UI layer — lives inside <Tldraw> context.
// Manages DNA panel visibility based on frame selection.
// Reference: grain-prd.md Section 11.3

import { useState, useEffect, useRef, useCallback, MutableRefObject } from 'react'
import { useEditor, useValue } from 'tldraw'
import { OrganizeButton } from './OrganizeButton'
import { AIActionBar } from './AIActionBar'
import { GrainSelectionToolbar } from './GrainSelectionToolbar'
import { DNAPanelV2 } from '../dna/DNAPanelV2'

interface CanvasUIProps {
  canvasId: string
  askAIRef: MutableRefObject<() => void>
}

export function CanvasUI({ canvasId, askAIRef }: CanvasUIProps) {
  const editor = useEditor()
  const [activeBoardName, setActiveBoardName] = useState<string | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const [toolbarAI, setToolbarAI] = useState(false)
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

  return (
    <>
      <OrganizeButton canvasId={canvasId} />
      <GrainSelectionToolbar onAskAI={handleAskAI} />
      <AIActionBar
        canvasId={canvasId}
        onExtractDna={handleExtractDna}
        forceExpanded={toolbarAI}
        onForceExpandedConsumed={() => setToolbarAI(false)}
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
