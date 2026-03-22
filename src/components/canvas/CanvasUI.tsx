'use client'

// Canvas UI layer — lives inside <Tldraw> context.
// Manages DNA panel visibility based on frame selection.
// Reference: grain-prd.md Section 11.3

import { useState, useEffect } from 'react'
import { useEditor, useValue } from 'tldraw'
import { OrganizeButton } from './OrganizeButton'
import { DNAPanel } from '../dna/DNAPanel'

interface CanvasUIProps {
  canvasId: string
}

export function CanvasUI({ canvasId }: CanvasUIProps) {
  const editor = useEditor()
  const [activeBoardName, setActiveBoardName] = useState<string | null>(null)

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
        return
      }
    }
    // Don't auto-close when selecting other things — let user close manually
  }, [selectedShapes])

  return (
    <>
      <OrganizeButton canvasId={canvasId} />
      <DNAPanel
        boardName={activeBoardName}
        canvasId={canvasId}
        onClose={() => setActiveBoardName(null)}
      />
    </>
  )
}
