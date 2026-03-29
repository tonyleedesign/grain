'use client'

// Custom context menu — extends tldraw's default with "Ask AI..." option.
// Renders all default items (cut, copy, paste, etc.) plus a custom AI group.

import {
  DefaultContextMenu,
  DefaultContextMenuContent,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  TLUiContextMenuProps,
  useEditor,
} from 'tldraw'
import { AISparkleIcon } from './AISparkleIcon'

/**
 * Creates a context menu component that includes tldraw defaults + "Ask AI..."
 */
export function createGrainContextMenu(onAskAI: (anchor?: { x: number; y: number }) => void) {
  return function GrainContextMenu(props: TLUiContextMenuProps) {
    const editor = useEditor()

    return (
      <DefaultContextMenu {...props}>
        <TldrawUiMenuGroup id="grain-ai">
          <TldrawUiMenuItem
            id="ask-ai"
            label="Ask AI..."
            icon={<AISparkleIcon size={14} />}
            onSelect={() => {
              const screenPoint = editor.inputs.getCurrentScreenPoint()
              onAskAI({ x: screenPoint.x, y: screenPoint.y })
            }}
          />
        </TldrawUiMenuGroup>
        <DefaultContextMenuContent />
      </DefaultContextMenu>
    )
  }
}
