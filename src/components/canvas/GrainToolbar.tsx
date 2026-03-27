'use client'

import {
  AssetToolbarItem,
  ArrowDownToolbarItem,
  ArrowLeftToolbarItem,
  ArrowRightToolbarItem,
  ArrowToolbarItem,
  ArrowUpToolbarItem,
  CheckBoxToolbarItem,
  CloudToolbarItem,
  DefaultToolbar,
  DiamondToolbarItem,
  DrawToolbarItem,
  EllipseToolbarItem,
  EraserToolbarItem,
  FrameToolbarItem,
  HandToolbarItem,
  HeartToolbarItem,
  HexagonToolbarItem,
  HighlightToolbarItem,
  LaserToolbarItem,
  LineToolbarItem,
  NoteToolbarItem,
  OvalToolbarItem,
  RectangleToolbarItem,
  RhombusToolbarItem,
  SelectToolbarItem,
  StarToolbarItem,
  TextToolbarItem,
  TldrawUiButtonIcon,
  TldrawUiToolbarButton,
  TriangleToolbarItem,
  useToasts,
  useEditor,
  useValue,
  XBoxToolbarItem,
} from 'tldraw'
import { useCallback, useState } from 'react'
import { getUngroupedImages, organizeImages } from '@/lib/organizeImages'

interface GrainToolbarProps {
  canvasId: string
}

function OrganizeToolbarButton({ canvasId }: GrainToolbarProps) {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [isOrganizing, setIsOrganizing] = useState(false)

  const ungroupedCount = useValue(
    'ungroupedImageCount',
    () => getUngroupedImages(editor).length,
    [editor]
  )

  const handleOrganize = useCallback(async () => {
    if (isOrganizing) return

    if (ungroupedCount === 0) {
      addToast({
        title: 'Nothing to organize',
        description: 'Add or ungroup some images first.',
        severity: 'warning',
      })
      return
    }

    setIsOrganizing(true)
    try {
      await organizeImages(editor, canvasId)
    } finally {
      setIsOrganizing(false)
    }
  }, [addToast, canvasId, editor, isOrganizing, ungroupedCount])

  return (
    <TldrawUiToolbarButton
      type="tool"
      title="Organize"
      tooltip="Organize"
      disabled={isOrganizing}
      onClick={handleOrganize}
      className="grain-organize-toolbar-button"
    >
      <TldrawUiButtonIcon icon="pack" />
    </TldrawUiToolbarButton>
  )
}

export function createGrainToolbar(canvasId: string) {
  return function GrainToolbar() {
    return (
      <DefaultToolbar>
        <SelectToolbarItem />
        <HandToolbarItem />
        <DrawToolbarItem />
        <TextToolbarItem />

        <OrganizeToolbarButton canvasId={canvasId} />

        <AssetToolbarItem />
        <NoteToolbarItem />
        <EraserToolbarItem />
        <RectangleToolbarItem />
        <EllipseToolbarItem />
        <TriangleToolbarItem />
        <DiamondToolbarItem />
        <HexagonToolbarItem />
        <OvalToolbarItem />
        <RhombusToolbarItem />
        <StarToolbarItem />
        <CloudToolbarItem />
        <HeartToolbarItem />
        <XBoxToolbarItem />
        <CheckBoxToolbarItem />
        <ArrowLeftToolbarItem />
        <ArrowUpToolbarItem />
        <ArrowDownToolbarItem />
        <ArrowRightToolbarItem />
        <LineToolbarItem />
        <HighlightToolbarItem />
        <LaserToolbarItem />
        <FrameToolbarItem />
        <ArrowToolbarItem />
      </DefaultToolbar>
    )
  }
}
