'use client'

// Canvas UI layer — lives inside <Tldraw> context.
// Manages DNA panel visibility based on frame selection.
// Reference: grain-prd.md Section 11.3

import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, useValue } from 'tldraw'
import { OrganizeButton } from './OrganizeButton'
import { AIActionBar } from './AIActionBar'
import { DNAPanelV2 } from '../dna/DNAPanelV2'

interface CanvasUIProps {
  canvasId: string
}

export function CanvasUI({ canvasId }: CanvasUIProps) {
  const editor = useEditor()
  const [activeBoardName, setActiveBoardName] = useState<string | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const [rightClickAI, setRightClickAI] = useState(false)
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

  // Right-click context menu: "Ask AI..." option
  useEffect(() => {
    const container = document.querySelector('.grain-canvas-wrapper')
    if (!container) return

    const handleContextMenu = (e: Event) => {
      const mouseEvent = e as MouseEvent
      mouseEvent.preventDefault()

      const existing = document.getElementById('grain-context-menu')
      if (existing) existing.remove()

      const menu = document.createElement('div')
      menu.id = 'grain-context-menu'
      menu.style.cssText = `
        position: fixed;
        left: ${mouseEvent.clientX}px;
        top: ${mouseEvent.clientY}px;
        z-index: 2000;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-panel);
        padding: 4px;
        font-family: var(--font-family);
        font-size: 12px;
      `

      const askAI = document.createElement('button')
      askAI.innerHTML = '&#x2728; Ask AI...'
      askAI.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 6px 12px;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text);
        font-family: var(--font-family);
        font-size: 12px;
        cursor: pointer;
        text-align: left;
      `
      askAI.onmouseenter = () => { askAI.style.background = 'var(--color-bg)' }
      askAI.onmouseleave = () => { askAI.style.background = 'transparent' }
      askAI.onclick = () => {
        menu.remove()
        setRightClickAI(true)
      }

      menu.appendChild(askAI)
      document.body.appendChild(menu)

      const cleanup = () => {
        menu.remove()
        document.removeEventListener('mousedown', cleanup)
      }
      setTimeout(() => document.addEventListener('mousedown', cleanup), 0)
    }

    container.addEventListener('contextmenu', handleContextMenu)
    return () => container.removeEventListener('contextmenu', handleContextMenu)
  }, [editor])

  const boardToRender = activeBoardName || lastBoardName.current

  return (
    <>
      <OrganizeButton canvasId={canvasId} />
      <AIActionBar
        canvasId={canvasId}
        onExtractDna={handleExtractDna}
        forceExpanded={rightClickAI}
        onForceExpandedConsumed={() => setRightClickAI(false)}
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
