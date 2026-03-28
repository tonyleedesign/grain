'use client'

// Custom image toolbar — extends tldraw's default with an AI sparkle button.
// Wraps DefaultImageToolbar, passing custom children that include the default
// content plus an AI button that triggers the AIActionBar expansion.

import {
  DefaultImageToolbar,
  DefaultImageToolbarContent,
  TldrawUiToolbarButton,
  TldrawUiButtonIcon,
  useEditor,
  useValue,
  TLImageShape,
  useToasts,
} from 'tldraw'
import { useCallback, useState } from 'react'
import { AISparkleIcon } from './AISparkleIcon'
import { GroupBoardIcon } from './GroupBoardIcon'
import { groupShapesIntoBoard } from '@/lib/board-grouping'

interface GrainImageToolbarInnerProps {
  canvasId: string
  onAskAI: () => void
  imageShapeId: TLImageShape['id']
}

function GrainImageToolbarInner({ canvasId, onAskAI, imageShapeId }: GrainImageToolbarInnerProps) {
  const editor = useEditor()
  const { addToast } = useToasts()
  const isInCropTool = useValue('editor path', () => editor.isIn('select.crop.'), [editor])

  const handleManipulatingEnd = useCallback(() => {
    editor.setCroppingShape(null)
    editor.setCurrentTool('select.idle')
  }, [editor])

  const handleManipulatingStart = useCallback(
    () => editor.setCurrentTool('select.crop.idle'),
    [editor]
  )

  const [isEditingAltText, setIsEditingAltText] = useState(false)

  const handleGroupAsBoard = useCallback(async () => {
    const image = editor.getShape(imageShapeId)
    if (!image) return

    try {
      const result = await groupShapesIntoBoard(editor, canvasId, [image])
      if (!result) return

      addToast({
        title: 'Board created',
        description: `Grouped ${result.count} item into ${result.boardName}.`,
        severity: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Grouping failed',
        description: error instanceof Error ? error.message : 'Failed to create board.',
        severity: 'error',
      })
    }
  }, [addToast, canvasId, editor, imageShapeId])

  // When in crop mode or editing alt text, don't show the AI button
  if (isInCropTool || isEditingAltText) {
    return (
      <DefaultImageToolbarContent
        imageShapeId={imageShapeId}
        isManipulating={isInCropTool}
        onEditAltTextStart={() => setIsEditingAltText(true)}
        onManipulatingStart={handleManipulatingStart}
        onManipulatingEnd={handleManipulatingEnd}
      />
    )
  }

  return (
    <>
      <DefaultImageToolbarContent
        imageShapeId={imageShapeId}
        isManipulating={false}
        onEditAltTextStart={() => setIsEditingAltText(true)}
        onManipulatingStart={handleManipulatingStart}
        onManipulatingEnd={handleManipulatingEnd}
      />
      <TldrawUiToolbarButton
        type="icon"
        title="Group as board"
        onClick={() => {
          void handleGroupAsBoard()
        }}
      >
        <TldrawUiButtonIcon
          small
          icon={<GroupBoardIcon size={13} />}
        />
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

/**
 * Creates a GrainImageToolbar component factory.
 * The returned component is used as the `ImageToolbar` override in TLComponents.
 */
export function createGrainImageToolbar(onAskAI: () => void, canvasId: string) {
  return function GrainImageToolbar() {
    const editor = useEditor()
    const imageShapeId = useValue(
      'imageShape',
      () => {
        const onlySelectedShape = editor.getOnlySelectedShape()
        if (!onlySelectedShape || onlySelectedShape.type !== 'image') return null
        return onlySelectedShape.id
      },
      [editor]
    )

    if (!imageShapeId) return null

    return (
      <DefaultImageToolbar>
        <GrainImageToolbarInner canvasId={canvasId} onAskAI={onAskAI} imageShapeId={imageShapeId} />
      </DefaultImageToolbar>
    )
  }
}
