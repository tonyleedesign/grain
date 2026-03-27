'use client'

import { useEditor, usePassThroughWheelEvents, useTldrawUiComponents, useValue, TldrawUiRow, TldrawUiToolbar } from 'tldraw'
import { memo, useRef } from 'react'

export const GrainMenuPanel = memo(function GrainMenuPanel() {
  const ref = useRef<HTMLDivElement>(null)
  usePassThroughWheelEvents(ref)

  const { MainMenu, QuickActions, ActionsMenu, PageMenu } = useTldrawUiComponents()

  const editor = useEditor()
  const isSinglePageMode = useValue('isSinglePageMode', () => editor.options.maxPages <= 1, [editor])

  if (!MainMenu && !PageMenu && !QuickActions && !ActionsMenu) return null

  return (
    <nav ref={ref} className="grain-menu-panel">
      <TldrawUiRow className="grain-menu-panel__row">
        {MainMenu && <MainMenu />}
        {PageMenu && !isSinglePageMode && <PageMenu />}
        {ActionsMenu && (
          <TldrawUiToolbar
            orientation="horizontal"
            label="More actions"
            className="grain-menu-panel__single-action"
          >
            <ActionsMenu />
          </TldrawUiToolbar>
        )}
        {QuickActions && (
          <TldrawUiToolbar
            orientation="horizontal"
            label="Quick actions"
            className="grain-menu-panel__quick-actions"
          >
            <QuickActions />
          </TldrawUiToolbar>
        )}
      </TldrawUiRow>
    </nav>
  )
})
