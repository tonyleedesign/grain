'use client'

// Canvas UI layer — lives inside <Tldraw> context.
// Manages DNA panel visibility based on frame selection.
// Reference: grain-prd.md Section 11.3

import { useState, useEffect, useRef } from 'react'
import { useEditor, useValue } from 'tldraw'
import { OrganizeButton } from './OrganizeButton'
import { SelectionActionBar } from './SelectionActionBar'
import { DNAPanelV2 } from '../dna/DNAPanelV2'

interface CanvasUIProps {
  canvasId: string
}

export function CanvasUI({ canvasId }: CanvasUIProps) {
  const editor = useEditor()
  const [activeBoardName, setActiveBoardName] = useState<string | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  // Keep track of last board name so the panel stays mounted when hidden
  const lastBoardName = useRef<string | null>(null)

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
    // Nothing selected (clicked empty canvas) — hide the panel but keep it mounted
    if (selectedShapes.length === 0) {
      setPanelVisible(false)
    }
  }, [selectedShapes])

  const boardToRender = activeBoardName || lastBoardName.current

  return (
    <>
      <OrganizeButton canvasId={canvasId} />
      <SelectionActionBar canvasId={canvasId} />
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
