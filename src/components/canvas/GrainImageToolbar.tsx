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
} from 'tldraw'
import { useCallback, useState } from 'react'
import { AISparkleIcon } from './AISparkleIcon'

interface GrainImageToolbarInnerProps {
  onAskAI: () => void
  imageShapeId: TLImageShape['id']
}

function GrainImageToolbarInner({ onAskAI, imageShapeId }: GrainImageToolbarInnerProps) {
  const editor = useEditor()
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
export function createGrainImageToolbar(onAskAI: () => void) {
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
        <GrainImageToolbarInner onAskAI={onAskAI} imageShapeId={imageShapeId} />
      </DefaultImageToolbar>
    )
  }
}
