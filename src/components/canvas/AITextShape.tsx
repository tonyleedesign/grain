'use client'

// AI Text Shape — custom tldraw shape for AI-generated text on the canvas.
// Styled with Grain tokens, distinguished from user content with accent left border.

import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  T,
  RecordProps,
} from 'tldraw'
import { ChatMessage } from '@/types/canvas-ai'

// Module augmentation to register custom shape type with tldraw
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'ai-text': AITextProps
  }
}

interface AITextProps {
  w: number
  h: number
  text: string            // legacy — kept for compat
  messages: string        // JSON stringified ChatMessage[]
  selectionContext: string // JSON stringified — snapshot of original selection context
  title: string           // auto-generated, user-editable
}

export type AITextShape = TLBaseShape<'ai-text', AITextProps>

export const aiTextProps: RecordProps<AITextShape> = {
  w: T.number,
  h: T.number,
  text: T.string,
  messages: T.string,
  selectionContext: T.string,
  title: T.string,
}

const PADDING = 12
const BORDER_WIDTH = 3
const FONT_SIZE = 13
const LINE_HEIGHT = 1.5
export function getMessages(shape: AITextShape): ChatMessage[] {
  try {
    const msgs: ChatMessage[] = JSON.parse(shape.props.messages)
    if (msgs.length > 0) return msgs
  } catch {}
  // Legacy compat: if no messages but has text, treat as single assistant message
  if (shape.props.text) {
    return [{ role: 'assistant', text: shape.props.text, timestamp: 0 }]
  }
  return []
}

export class AITextShapeUtil extends ShapeUtil<AITextShape> {
  static override type = 'ai-text' as const
  static override props = aiTextProps

  getGeometry(shape: AITextShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  getDefaultProps(): AITextProps {
    return {
      w: 360,
      h: 40,
      text: '',
      messages: '[]',
      selectionContext: '{}',
      title: '',
    }
  }

  override canResize() { return true }
  override canEdit() { return false }

  component(shape: AITextShape) {
    return (
      <HTMLContainer>
        <div
          style={{
            width: shape.props.w,
            minHeight: shape.props.h,
            backgroundColor: 'var(--color-surface)',
            borderLeft: `${BORDER_WIDTH}px solid var(--color-accent)`,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
            fontFamily: 'var(--font-display, var(--font-family))',
            color: 'var(--color-text)',
            fontSize: FONT_SIZE,
            lineHeight: LINE_HEIGHT,
            padding: PADDING,
            paddingLeft: PADDING + BORDER_WIDTH,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            pointerEvents: 'all',
          }}
        >
          {shape.props.text}
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: AITextShape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={8}
        ry={8}
      />
    )
  }
}
