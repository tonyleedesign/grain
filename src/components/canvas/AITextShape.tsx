'use client'

// AI Text Shape — custom tldraw shape for AI-generated text on the canvas.
// Styled with Grain tokens, distinguished from user content with accent left border.

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  T,
  RecordProps,
  useEditor,
  TLShapeId,
} from 'tldraw'
import { createShapePropsMigrationIds, createShapePropsMigrationSequence } from '@tldraw/tlschema'
import { Reply, Send, Minus } from 'lucide-react'
import { ChatMessage, CanvasAIChatRequest, CanvasAIToolCall } from '@/types/canvas-ai'
import { buildSelectionContext } from '@/lib/selection-context'
import { streamToShape, executeToolCalls } from '@/lib/canvas-ai-executor'
import { AISparkleIcon } from './AISparkleIcon'
import './ai-chat-card.css'

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

// --- Shape migrations (handle old shapes missing new props) ---

const versions = createShapePropsMigrationIds('ai-text', {
  AddChatFields: 1,
})

const aiTextMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: versions.AddChatFields,
      up: (props: Record<string, unknown>) => {
        if (props.messages === undefined) props.messages = '[]'
        if (props.selectionContext === undefined) props.selectionContext = '{}'
        if (props.title === undefined) props.title = ''
      },
      down: (props: Record<string, unknown>) => {
        delete props.messages
        delete props.selectionContext
        delete props.title
      },
    },
  ],
})

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

function getCanvasId(): string {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/\/canvas\/([^/]+)/)
  return match?.[1] || ''
}

async function sendChatMessage(
  editor: ReturnType<typeof useEditor>,
  shapeId: TLShapeId,
  userText: string,
  canvasId: string
) {
  const shape = editor.getShape(shapeId) as AITextShape | undefined
  if (!shape) return

  const messages: ChatMessage[] = JSON.parse(shape.props.messages)

  // Append user message
  messages.push({ role: 'user', text: userText, timestamp: Date.now() })
  // Append empty assistant message for streaming
  messages.push({ role: 'assistant', text: '', timestamp: Date.now() })

  // Update shape to show user message + empty assistant placeholder
  editor.updateShape({
    id: shapeId,
    type: 'ai-text',
    props: {
      messages: JSON.stringify(messages),
      h: 280, // Ensure chat mode height
    },
  })

  // Build current selection context
  const currentContext = buildSelectionContext(editor)

  // Call streaming endpoint
  const res = await fetch('/api/canvas-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      originalContext: shape.props.selectionContext,
      currentContext,
      canvasId,
    } satisfies CanvasAIChatRequest),
  })

  if (!res.ok || !res.body) {
    // Update last message with error
    messages[messages.length - 1].text = 'Error: request failed'
    editor.updateShape({
      id: shapeId,
      type: 'ai-text',
      props: { messages: JSON.stringify(messages) },
    })
    return
  }

  // Stream response into the shape
  const { toolCalls } = await streamToShape(editor, shapeId, res.body)

  // Execute any tool calls
  if (toolCalls.length > 0) {
    await executeToolCalls(editor, toolCalls, canvasId)
  }
}

function SimpleMode({
  shape,
  messages,
  isStreaming,
}: {
  shape: AITextShape
  messages: ChatMessage[]
  isStreaming: boolean
}) {
  const editor = useEditor()
  const text = messages[0]?.text || ''
  const hasContent = text.length > 0

  let className = 'ai-card ai-card-simple'
  if (!hasContent) {
    className += ' ai-card-shimmer-active'
  } else if (isStreaming) {
    className += ' ai-card-shimmer-active ai-card-shimmer-streaming'
  }

  const handleReply = useCallback(() => {
    editor.updateShape({
      id: shape.id,
      type: 'ai-text',
      props: { h: 280 },
    })
  }, [editor, shape.id])

  return (
    <div
      className={className}
      style={{
        width: shape.props.w,
        minHeight: shape.props.h,
        pointerEvents: 'all',
      }}
    >
      {text || '\u00A0'}
      {hasContent && !isStreaming && (
        <button className="ai-card-reply-btn" title="Reply" onClick={handleReply}>
          <Reply size={13} />
        </button>
      )}
    </div>
  )
}

function ChatMode({
  shape,
  messages,
  isStreaming,
}: {
  shape: AITextShape
  messages: ChatMessage[]
  isStreaming: boolean
}) {
  const editor = useEditor()
  const [inputValue, setInputValue] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input when chat mode opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Auto-scroll to bottom on new messages (unless user scrolled up)
  useEffect(() => {
    if (!userScrolledRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const { scrollTop, scrollHeight, clientHeight } = container
    userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 40
  }, [])

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isStreaming) return
    const text = inputValue.trim()
    setInputValue('')
    sendChatMessage(editor, shape.id as TLShapeId, text, getCanvasId())
  }, [editor, shape.id, inputValue, isStreaming])

  // If minimized, show last message in simple mode appearance
  if (isMinimized) {
    const lastMsg = messages[messages.length - 1]
    return (
      <div
        className="ai-card ai-card-simple"
        style={{
          width: shape.props.w,
          minHeight: 40,
          pointerEvents: 'all',
          cursor: 'pointer',
        }}
        onDoubleClick={() => setIsMinimized(false)}
      >
        {lastMsg?.text || '\u00A0'}
        <button
          className="ai-card-reply-btn"
          style={{ opacity: 1 }}
          onClick={() => setIsMinimized(false)}
          title="Expand chat"
        >
          <Reply size={13} />
        </button>
      </div>
    )
  }

  const shimmerClass = isStreaming ? ' ai-card-shimmer-active ai-card-shimmer-streaming' : ''

  return (
    <div
      className={`ai-card ai-card-chat${shimmerClass}`}
      style={{
        width: shape.props.w,
        height: Math.max(200, shape.props.h),
        pointerEvents: 'all',
      }}
    >
      {/* Header */}
      <div className="ai-card-header">
        <AISparkleIcon size={12} />
        <input
          className="ai-card-title"
          value={shape.props.title || 'Chat'}
          readOnly
          title={shape.props.title || 'Chat'}
        />
        <span className="ai-card-badge">{messages.length}</span>
        <button
          className="ai-card-minimize"
          onClick={() => setIsMinimized(true)}
          title="Minimize"
        >
          <Minus size={12} />
        </button>
      </div>

      {/* Messages */}
      <div
        className="ai-card-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`ai-card-msg ai-card-msg-${msg.role}`}>
            {msg.text || '\u00A0'}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="ai-card-input-bar">
        <input
          ref={inputRef}
          className="ai-card-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && inputValue.trim() && !isStreaming) {
              handleSend()
            }
          }}
          placeholder="Reply..."
          disabled={isStreaming}
        />
        <button
          className="ai-card-send"
          disabled={!inputValue.trim() || isStreaming}
          onClick={handleSend}
        >
          <Send size={11} />
        </button>
      </div>
    </div>
  )
}

export class AITextShapeUtil extends ShapeUtil<AITextShape> {
  static override type = 'ai-text' as const
  static override props = aiTextProps
  static override migrations = aiTextMigrations

  getGeometry(shape: AITextShape) {
    const messages = getMessages(shape)
    const isChat = messages.length > 1
    return new Rectangle2d({
      width: shape.props.w,
      height: isChat ? Math.max(200, shape.props.h) : shape.props.h,
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
    const messages = getMessages(shape)
    // Show chat mode if: 2+ messages OR shape was explicitly resized for chat (reply clicked)
    const isChat = messages.length > 1 || (messages.length === 1 && shape.props.h >= 200)
    const isStreaming = messages.length > 0 &&
      messages[messages.length - 1].role === 'assistant' &&
      messages[messages.length - 1].text === ''

    if (!isChat) {
      return (
        <HTMLContainer>
          <SimpleMode shape={shape} messages={messages} isStreaming={isStreaming} />
        </HTMLContainer>
      )
    }

    return (
      <HTMLContainer>
        <ChatMode shape={shape} messages={messages} isStreaming={isStreaming} />
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
