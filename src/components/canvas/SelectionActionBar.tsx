'use client'

// Contextual action bar — appears above selected images when 2+ ungrouped images are selected.
// Allows manual grouping into a board frame without AI organize.

import { useState, useCallback } from 'react'
import { useEditor, useValue, TLImageShape, TLShapeId, createShapeId } from 'tldraw'
import { Layers } from 'lucide-react'

const BOARD_PADDING = 24
const IMAGE_GAP = 12
const IMAGES_PER_ROW = 3

interface SelectionActionBarProps {
  canvasId: string
}

export function SelectionActionBar({ canvasId }: SelectionActionBarProps) {
  const editor = useEditor()
  const [naming, setNaming] = useState(false)
  const [boardName, setBoardName] = useState('')
  const [isGrouping, setIsGrouping] = useState(false)

  // Reactively get selected ungrouped images
  const selectedImages = useValue(
    'selectedImages',
    () => {
      const selected = editor.getSelectedShapes()
      return selected.filter((s): s is TLImageShape => {
        if (s.type !== 'image') return false
        const parent = editor.getShape(s.parentId as TLShapeId)
        return !parent || parent.type !== 'frame'
      })
    },
    [editor]
  )

  // Get selection bounds in viewport coords for positioning
  const barPosition = useValue(
    'barPosition',
    () => {
      const bounds = editor.getSelectionPageBounds()
      if (!bounds) return null
      const viewportTop = editor.pageToViewport({ x: bounds.midX, y: bounds.minY })
      return { x: viewportTop.x, y: viewportTop.y }
    },
    [editor]
  )

  const handleGroup = useCallback(async () => {
    const name = boardName.trim()
    if (!name || selectedImages.length === 0) return

    setIsGrouping(true)
    try {
      // Lay images out side by side, preserving aspect ratios.
      // Each image is scaled to a consistent row height.
      const ROW_HEIGHT = 250
      const MAX_ROW_WIDTH = 900

      // Calculate scaled dimensions for each image
      const scaled = selectedImages.map((img) => {
        const aspect = img.props.w / (img.props.h || 1)
        const w = Math.round(ROW_HEIGHT * aspect)
        return { img, w, h: ROW_HEIGHT }
      })

      // Pack images into rows that don't exceed MAX_ROW_WIDTH
      const rows: typeof scaled[] = []
      let currentRow: typeof scaled = []
      let currentRowWidth = 0

      for (const item of scaled) {
        const itemTotalWidth = currentRow.length > 0 ? IMAGE_GAP + item.w : item.w
        if (currentRowWidth + itemTotalWidth > MAX_ROW_WIDTH && currentRow.length > 0) {
          rows.push(currentRow)
          currentRow = [item]
          currentRowWidth = item.w
        } else {
          currentRow.push(item)
          currentRowWidth += itemTotalWidth
        }
      }
      if (currentRow.length > 0) rows.push(currentRow)

      // Calculate frame size from the packed rows
      const rowWidths = rows.map((row) =>
        row.reduce((sum, item) => sum + item.w, 0) + (row.length - 1) * IMAGE_GAP
      )
      const maxRowWidth = Math.max(...rowWidths)
      const totalHeight = rows.length * ROW_HEIGHT + (rows.length - 1) * IMAGE_GAP
      const frameW = maxRowWidth + BOARD_PADDING * 2
      const frameH = totalHeight + BOARD_PADDING * 2 + 40 // +40 for frame header

      // Position frame at the center of selected images
      const avgX = selectedImages.reduce((sum, img) => sum + img.x, 0) / selectedImages.length
      const avgY = selectedImages.reduce((sum, img) => sum + img.y, 0) / selectedImages.length

      const frameId = createShapeId()
      const createBoardResponse = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, canvasId, frameShapeId: frameId }),
      })

      if (!createBoardResponse.ok) {
        throw new Error('Failed to create board record')
      }

      const { id: boardId } = await createBoardResponse.json()

      editor.run(() => {
        editor.createShape({
          id: frameId,
          type: 'frame',
          x: avgX - frameW / 2,
          y: avgY - frameH / 2,
          meta: { boardId },
          props: { w: frameW, h: frameH, name },
        })

        // Place each image at its calculated position
        let rowY = BOARD_PADDING + 40
        for (const row of rows) {
          let x = BOARD_PADDING
          for (const item of row) {
            editor.updateShape({
              id: item.img.id as TLShapeId,
              type: 'image',
              parentId: frameId,
              x,
              y: rowY,
              props: { ...item.img.props, w: item.w, h: item.h },
            })
            x += item.w + IMAGE_GAP
          }
          rowY += ROW_HEIGHT + IMAGE_GAP
        }
      })

      // Select the new frame
      editor.select(frameId)

      // Reset state
      setNaming(false)
      setBoardName('')
    } finally {
      setIsGrouping(false)
    }
  }, [boardName, selectedImages, editor, canvasId])

  // Only show when 2+ ungrouped images are selected
  if (selectedImages.length < 2 || !barPosition) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: barPosition.x,
        top: barPosition.y - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'auto',
      }}
    >
      {naming ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-toolbar)',
            fontFamily: 'var(--font-family)',
          }}
        >
          <input
            autoFocus
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && boardName.trim()) handleGroup()
              if (e.key === 'Escape') { setNaming(false); setBoardName('') }
            }}
            placeholder="Board name..."
            style={{
              width: 140,
              padding: '4px 8px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: 13,
              fontFamily: 'var(--font-family)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleGroup}
            disabled={!boardName.trim() || isGrouping}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: boardName.trim() ? 'var(--color-accent)' : 'var(--color-border)',
              color: 'var(--color-surface)',
              border: 'none',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-family)',
              cursor: boardName.trim() ? 'pointer' : 'default',
              opacity: isGrouping ? 0.7 : 1,
            }}
          >
            {isGrouping ? '...' : 'Create'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setNaming(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
            fontSize: 13,
            fontWeight: 500,
            boxShadow: 'var(--shadow-toolbar)',
            transition: 'opacity 0.15s ease',
          }}
        >
          <Layers size={14} style={{ color: 'var(--color-accent)' }} />
          Group {selectedImages.length} as Board
        </button>
      )}
    </div>
  )
}
