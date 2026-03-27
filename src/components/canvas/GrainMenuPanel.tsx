'use client'

// Custom MenuPanel — mirrors DefaultMenuPanel structure but uses Grain's
// custom MainMenu and PageMenu while keeping tldraw's layout classes intact.

import {
  useEditor,
  usePassThroughWheelEvents,
  useTldrawUiComponents,
  useValue,
  useBreakpoint,
  PORTRAIT_BREAKPOINT,
  TldrawUiRow,
  TldrawUiToolbar,
} from 'tldraw'
import { memo, useRef } from 'react'

export const GrainMenuPanel = memo(function GrainMenuPanel() {
  const ref = useRef<HTMLDivElement>(null)
  usePassThroughWheelEvents(ref)

  const { MainMenu, PageMenu, QuickActions, ActionsMenu } = useTldrawUiComponents()

  const editor = useEditor()
  const breakpoint = useBreakpoint()
  const isSinglePageMode = useValue('isSinglePageMode', () => editor.options.maxPages <= 1, [editor])

  const showQuickActions =
    editor.options.actionShortcutsLocation === 'menu'
      ? true
      : editor.options.actionShortcutsLocation === 'toolbar'
        ? false
        : breakpoint >= PORTRAIT_BREAKPOINT.TABLET

  if (!MainMenu && !PageMenu && !showQuickActions) return null

  return (
    <nav ref={ref} className="tlui-menu-zone">
      <TldrawUiRow>
        {MainMenu && <MainMenu />}
        {PageMenu && !isSinglePageMode && <PageMenu />}
        {showQuickActions ? (
          <TldrawUiToolbar orientation="horizontal" label="Actions menu">
            {QuickActions && <QuickActions />}
            {ActionsMenu && <ActionsMenu />}
          </TldrawUiToolbar>
        ) : null}
      </TldrawUiRow>
    </nav>
  )
})
