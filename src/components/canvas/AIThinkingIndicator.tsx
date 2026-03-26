'use client'

// AI Thinking Indicator — pulsing sparkle icon + status text.
// Positioned at the selection point, replacing the AI action bar during processing.

import { useEditor, useValue } from 'tldraw'
import { Sparkles } from 'lucide-react'

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
        boxShadow: 'var(--shadow-toolbar)',
        fontFamily: 'var(--font-family)',
        fontSize: 12,
        color: 'var(--color-muted)',
        pointerEvents: 'none',
      }}
    >
      <Sparkles
        size={13}
        style={{
          color: 'var(--color-accent)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      {status}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
