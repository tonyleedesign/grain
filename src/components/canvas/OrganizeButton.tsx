'use client'

// Floating Organize button — triggers AI grouping of ungrouped images.
// Reference: grain-prd.md Section 5.3, 11.2

import { useState } from 'react'
import { useEditor } from 'tldraw'
import { organizeImages, getUngroupedImages } from '@/lib/organizeImages'

interface OrganizeButtonProps {
  canvasId: string
}

export function OrganizeButton({ canvasId }: OrganizeButtonProps) {
  const editor = useEditor()
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOrganize = async () => {
    setError(null)

    const ungrouped = getUngroupedImages(editor)
    if (ungrouped.length === 0) {
      setError('No ungrouped images to organize')
      setTimeout(() => setError(null), 3000)
      return
    }

    setIsOrganizing(true)
    try {
      await organizeImages(editor, canvasId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Organize failed')
    } finally {
      setIsOrganizing(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 84,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {error && (
        <div
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 13,
            boxShadow: 'var(--shadow-card)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {error}
        </div>
      )}
      <button
        onClick={handleOrganize}
        disabled={isOrganizing}
        style={{
          padding: '10px 24px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-surface)',
          border: 'none',
          cursor: isOrganizing ? 'wait' : 'pointer',
          fontFamily: 'var(--font-family)',
          fontSize: 14,
          fontWeight: 500,
          boxShadow: 'var(--shadow-toolbar)',
          opacity: isOrganizing ? 0.7 : 1,
          transition: 'opacity 0.18s ease',
        }}
      >
        {isOrganizing ? 'Organizing...' : 'Organize'}
      </button>
    </div>
  )
}
