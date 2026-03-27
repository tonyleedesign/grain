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
  TLResizeInfo,
  resizeBox,
} from 'tldraw'
import { createShapePropsMigrationIds, createShapePropsMigrationSequence } from '@tldraw/tlschema'
import { Reply, Send, Minus, Pencil, Check } from 'lucide-react'
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
  canvasId: string
  mode: 'simple' | 'chat'
  status: 'idle' | 'waiting' | 'streaming'
}

export type AITextShape = TLBaseShape<'ai-text', AITextProps>

export const aiTextProps: RecordProps<AITextShape> = {
  w: T.number,
  h: T.number,
  text: T.string,
  messages: T.string,
  selectionContext: T.string,
  title: T.string,
  canvasId: T.string,
  mode: T.literalEnum('simple', 'chat'),
  status: T.literalEnum('idle', 'waiting', 'streaming'),
}

// --- Shape migrations (handle old shapes missing new props) ---

const versions = createShapePropsMigrationIds('ai-text', {
  AddChatFields: 1,
  AddInteractionFields: 2,
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
    {
      id: versions.AddInteractionFields,
      up: (props: Record<string, unknown>) => {
        if (props.canvasId === undefined) props.canvasId = ''
        if (props.mode === undefined) {
          let mode: 'simple' | 'chat' = 'simple'
          try {
            const messages = JSON.parse(String(props.messages ?? '[]')) as ChatMessage[]
            if (messages.length > 1) mode = 'chat'
          } catch {}
          props.mode = mode
        }
        if (props.status === undefined) props.status = 'idle'
      },
      down: (props: Record<string, unknown>) => {
        delete props.canvasId
        delete props.mode
        delete props.status
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

function stopControlPointerEvent(e: React.PointerEvent | React.MouseEvent) {
  e.stopPropagation()
}

function getSimpleModeText(messages: ChatMessage[]): string {
  if (messages.length <= 1) {
    return messages[0]?.text || ''
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].text.trim()) {
      return messages[i].text
    }
  }

  return messages[messages.length - 1]?.text || ''
}

async function generateTitle(
  editor: ReturnType<typeof useEditor>,
  shapeId: TLShapeId,
  messages: ChatMessage[]
) {
  const summary = messages
    .slice(0, 4)
    .map((m) => `${m.role}: ${m.text.slice(0, 120)}`)
    .join('\n')

  try {
    const res = await fetch('/api/canvas-ai/title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    })
    if (!res.ok) return
    const { title } = await res.json()
    if (title) {
      editor.updateShape({
        id: shapeId,
        type: 'ai-text',
        props: { title },
      })
    }
  } catch {}
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
      mode: 'chat',
      status: 'waiting',
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
      props: { messages: JSON.stringify(messages), status: 'idle' },
    })
    return
  }

  // Stream response into the shape
  const { toolCalls } = await streamToShape(editor, shapeId, res.body)

  // Execute any tool calls
  if (toolCalls.length > 0) {
    await executeToolCalls(editor, toolCalls, canvasId)
  }

  // Generate title after first follow-up (3 messages = original + user + reply)
  const updatedShape = editor.getShape(shapeId) as AITextShape | undefined
  if (updatedShape) {
    const updatedMessages: ChatMessage[] = JSON.parse(updatedShape.props.messages)
    if (updatedMessages.length >= 3 && !updatedShape.props.title) {
      generateTitle(editor, shapeId, updatedMessages)
    }
  }
}

function useAutoTitle(shape: AITextShape, messages: ChatMessage[]) {
  const editor = useEditor()
  const lastRequestKey = useRef<string | null>(null)

  useEffect(() => {
    if (shape.props.title || shape.props.status !== 'idle') return

    const hasAssistantContent = messages.some(
      (msg) => msg.role === 'assistant' && msg.text.trim().length > 0
    )
    if (!hasAssistantContent) return

    const requestKey = `${shape.id}:${messages.length}:${messages[messages.length - 1]?.text.length ?? 0}`
    if (lastRequestKey.current === requestKey) return
    lastRequestKey.current = requestKey

    generateTitle(editor, shape.id as TLShapeId, messages)
  }, [editor, messages, shape.id, shape.props.status, shape.props.title])
}

function SimpleMode({
  shape,
  messages,
}: {
  shape: AITextShape
  messages: ChatMessage[]
}) {
  const editor = useEditor()
  const contentRef = useRef<HTMLDivElement>(null)
  const text = getSimpleModeText(messages)
  const hasContent = text.length > 0
  useAutoTitle(shape, messages)

  // Auto-size height to fit content (only in simple mode, not when switching to chat)
  useEffect(() => {
    const el = contentRef.current
    if (!el || !hasContent) return
    const measured = el.scrollHeight
    if (measured > 0 && Math.abs(measured - shape.props.h) > 2) {
      editor.updateShape({
        id: shape.id,
        type: 'ai-text',
        props: { h: measured },
      })
    }
  }, [editor, shape.id, shape.props.h, text, hasContent])

  let className = 'ai-card ai-card-simple'
  if (shape.props.status === 'waiting') {
    className += ' ai-card-shimmer-active'
  } else if (shape.props.status === 'streaming') {
    className += ' ai-card-shimmer-active ai-card-shimmer-streaming'
  }

  const handleReply = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    stopControlPointerEvent(e)
    editor.updateShape({
      id: shape.id,
      type: 'ai-text',
      props: {
        h: Math.max(280, shape.props.h),
        mode: 'chat',
      },
    })
  }, [editor, shape.id, shape.props.h])

  return (
    <div
      ref={contentRef}
      className={className}
      style={{
        width: shape.props.w,
        minHeight: shape.props.h,
        pointerEvents: 'all',
      }}
    >
      {text || '\u00A0'}
      {hasContent && shape.props.status === 'idle' && (
        <button
          className="ai-card-reply-btn"
          title="Reply"
          onPointerDown={handleReply}
        >
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
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(shape.props.title || 'Chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  useAutoTitle(shape, messages)

  // Auto-focus input when chat mode opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    if (editingTitle) {
      setTimeout(() => {
        titleInputRef.current?.focus()
        titleInputRef.current?.select()
      }, 0)
    }
  }, [editingTitle])

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

  const handleMessagesWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()

    const container = messagesContainerRef.current
    if (!container) return

    container.scrollTop += e.deltaY
    container.scrollLeft += e.deltaX
    handleScroll()
  }, [handleScroll])

  const handleTitleBlur = useCallback(() => {
    setEditingTitle(false)
    const trimmed = titleValue.trim() || (shape.props.title || 'Chat')
    if (trimmed !== shape.props.title) {
      editor.updateShape({
        id: shape.id,
        type: 'ai-text',
        props: { title: trimmed },
      })
    }
  }, [editor, shape.id, shape.props.title, titleValue])

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isStreaming) return
    const text = inputValue.trim()
    setInputValue('')
    sendChatMessage(editor, shape.id as TLShapeId, text, shape.props.canvasId)
  }, [editor, shape.id, shape.props.canvasId, inputValue, isStreaming])

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
        <div className="ai-card-header-icon">
          <AISparkleIcon size={12} />
        </div>
        <div className="ai-card-title-row">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              className="ai-card-title ai-card-title-input"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onPointerDown={stopControlPointerEvent}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setEditingTitle(false)
                  setTitleValue(shape.props.title || 'Chat')
                }
              }}
              title={shape.props.title || 'Chat'}
            />
          ) : (
            <div className="ai-card-title" title={shape.props.title || 'Chat'}>
              {shape.props.title || 'Chat'}
            </div>
          )}
          <button
            className="ai-card-header-btn"
            onPointerDown={(e) => {
              stopControlPointerEvent(e)
              if (editingTitle) {
                handleTitleBlur()
                return
              }
              setTitleValue(shape.props.title || 'Chat')
              setEditingTitle(true)
            }}
            title={editingTitle ? 'Save title' : 'Edit title'}
          >
            {editingTitle ? <Check size={12} /> : <Pencil size={12} />}
          </button>
        </div>
        <span className="ai-card-badge">{messages.length}</span>
        <button
          className="ai-card-header-btn"
          onPointerDown={(e) => {
            stopControlPointerEvent(e)
            editor.updateShape({
              id: shape.id,
              type: 'ai-text',
              props: { mode: 'simple', h: 40 },
            })
          }}
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
        onWheelCapture={handleMessagesWheel}
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
          onPointerDown={stopControlPointerEvent}
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
          onPointerDown={(e) => {
            stopControlPointerEvent(e)
            handleSend()
          }}
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
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.mode === 'chat' ? Math.max(200, shape.props.h) : shape.props.h,
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
      canvasId: '',
      mode: 'simple',
      status: 'idle',
    }
  }

  override canResize() { return true }
  override canEdit() { return false }

  override onResize(shape: AITextShape, info: TLResizeInfo<AITextShape>) {
    const minWidth = shape.props.mode === 'chat' ? 280 : 240
    const minHeight = shape.props.mode === 'chat' ? 220 : 40

    return resizeBox(shape, info, { minWidth, minHeight })
  }

  component(shape: AITextShape) {
    const messages = getMessages(shape)
    const isChat = shape.props.mode === 'chat'
    const isStreaming = shape.props.status !== 'idle'

    if (!isChat) {
      return (
        <HTMLContainer>
          <SimpleMode shape={shape} messages={messages} />
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

  override onDoubleClick(shape: AITextShape) {
    if (shape.props.mode === 'simple') {
      return {
        ...shape,
        props: {
          ...shape.props,
          mode: 'chat' as const,
          h: Math.max(280, shape.props.h),
        },
      }
    }

    return
  }
}
