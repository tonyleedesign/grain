'use client'

// Contextual toolbar for non-image selections (frames, multi-select, shapes).
// Shows common tldraw actions (delete, duplicate) + AI sparkle button.
// Mimics the pattern of DefaultImageToolbar using TldrawUiContextualToolbar.

import {
  TldrawUiContextualToolbar,
  TldrawUiToolbarButton,
  TldrawUiButtonIcon,
  useEditor,
  useValue,
  useActions,
  Box,
} from 'tldraw'
import { useCallback } from 'react'
import { AISparkleIcon } from './AISparkleIcon'

interface GrainSelectionToolbarProps {
  onAskAI: () => void
}

/**
 * Contextual toolbar for non-image, non-video selections.
 * Renders directly inside CanvasUI (no TLComponents slot needed).
 */
export function GrainSelectionToolbar({ onAskAI }: GrainSelectionToolbarProps) {
  const editor = useEditor()

  // Only show when we have a selection that's NOT a single image/video
  const shouldShow = useValue(
    'showSelectionToolbar',
    () => {
      const selected = editor.getSelectedShapes()
      if (selected.length === 0) return false

      // Single image — handled by GrainImageToolbar
      if (selected.length === 1 && selected[0].type === 'image') return false

      // Single video — handled by tldraw's VideoToolbar
      if (selected.length === 1 && selected[0].type === 'video') return false

      // Must be in select state
      if (!editor.isInAny('select.idle', 'select.pointing_shape')) return false

      // Don't show if any selected shape is locked
      if (selected.some((s) => s.isLocked)) return false

      return true
    },
    [editor]
  )

  const getSelectionBounds = useCallback(() => {
    const fullBounds = editor.getSelectionScreenBounds()
    if (!fullBounds) return undefined
    // Zero-height box at the top of selection — toolbar positions above it
    return new Box(fullBounds.x, fullBounds.y, fullBounds.width, 0)
  }, [editor])

  if (!shouldShow) return null

  return (
    <TldrawUiContextualToolbar
      className="tlui-media__toolbar"
      getSelectionBounds={getSelectionBounds}
      label="Selection toolbar"
    >
      <GrainSelectionToolbarContent onAskAI={onAskAI} />
    </TldrawUiContextualToolbar>
  )
}

function GrainSelectionToolbarContent({ onAskAI }: { onAskAI: () => void }) {
  const actions = useActions()

  return (
    <>
      <TldrawUiToolbarButton
        type="icon"
        title="Delete"
        onClick={() => actions['delete'].onSelect('toolbar')}
      >
        <TldrawUiButtonIcon small icon="trash" />
      </TldrawUiToolbarButton>
      <TldrawUiToolbarButton
        type="icon"
        title="Duplicate"
        onClick={() => actions['duplicate'].onSelect('toolbar')}
      >
        <TldrawUiButtonIcon small icon="duplicate" />
      </TldrawUiToolbarButton>
      <TldrawUiToolbarButton
        type="icon"
        title="Ask AI"
        onClick={onAskAI}
        style={{ borderLeft: '1px solid var(--tl-color-divider)', marginLeft: '2px' }}
      >
        <TldrawUiButtonIcon
          small
          icon={<AISparkleIcon size={13} />}
        />
      </TldrawUiToolbarButton>
    </>
  )
}
