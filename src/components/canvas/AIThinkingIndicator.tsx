'use client'

// AI Thinking Indicator — pulsing sparkle icon + status text.
// Positioned at the selection point, replacing the AI action bar during processing.

import { useEditor, useValue } from 'tldraw'
import { AISparkleIcon } from './AISparkleIcon'
import './ai-thinking-indicator.css'

interface AIThinkingIndicatorProps {
  status: string // e.g. "Thinking...", "Grouping images...", "Writing..."
}

export function AIThinkingIndicator({ status }: AIThinkingIndicatorProps) {
  const editor = useEditor()

  const position = useValue(
    'thinkingPosition',
    () => {
      const bounds = editor.getSelectionPageBounds()
      if (!bounds) return null
      return editor.pageToViewport({ x: bounds.midX, y: bounds.minY })
    },
    [editor]
  )

  if (!position) return null

  return (
    <div
      className="grain-ai-thinking-indicator"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-toolbar)',
        fontFamily: 'var(--font-display, var(--font-family))',
        fontSize: 12,
        color: 'var(--color-muted)',
        pointerEvents: 'none',
      }}
    >
      <div className="grain-ai-thinking-indicator__icon">
        <AISparkleIcon size={13} />
      </div>
      <span className="grain-ai-thinking-indicator__text">{status}</span>
    </div>
  )
}
