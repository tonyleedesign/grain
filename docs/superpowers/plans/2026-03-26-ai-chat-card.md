# AI Chat Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the static `ai-text` shape into a dual-mode component — clean text card (1 message) that upgrades to a mini chatbot (2+ messages) — with SSE streaming and shimmer effects during AI processing.

**Architecture:** Single tldraw custom shape (`ai-text`) with two render modes determined by message count. The API switches from JSON to SSE streaming. A CSS shimmer system (flowing border + wash gradient) activates during AI processing. Title auto-generated via background Haiku call after first exchange.

**Tech Stack:** tldraw ShapeUtil, React, CSS `@property` animations, Anthropic SDK streaming, Server-Sent Events (SSE), Next.js route handlers

**Spec:** `docs/superpowers/specs/2026-03-26-ai-chat-card-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/canvas/AITextShape.tsx` | **Major rewrite** | Shape util + dual-mode React component (simple + chat) |
| `src/components/canvas/ai-chat-card.css` | **Create** | Shimmer animations, chat layout, card styles |
| `src/app/api/canvas-ai/route.ts` | **Modify** | SSE streaming endpoint, multi-turn conversation support |
| `src/lib/canvas-ai-executor.ts` | **Modify** | Create shape immediately, `streamToShape()` function |
| `src/components/canvas/AIActionBar.tsx` | **Modify** | Wire send → create shape + start stream |
| `src/types/canvas-ai.ts` | **Modify** | Add streaming types, Message interface |

---

### Task 1: Update Types & Shape Data Model

**Files:**
- Modify: `src/types/canvas-ai.ts`
- Modify: `src/components/canvas/AITextShape.tsx`

- [ ] **Step 1: Add Message interface and streaming types to canvas-ai.ts**

Add these types after the existing `AISuggestion` interface:

```typescript
// --- Chat card message ---

export interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
  timestamp: number
}

// --- SSE streaming types ---

export type SSEEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; name: string; input: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; message: string }

// --- Multi-turn request ---

export interface CanvasAIChatRequest {
  messages: ChatMessage[]
  originalContext: string       // JSON stringified original selection context
  currentContext: CanvasAISelectionContext
  canvasId: string
}
```

- [ ] **Step 2: Update AITextProps in AITextShape.tsx**

Replace the current `AITextProps` interface and `aiTextProps` validator:

```typescript
interface AITextProps {
  w: number
  h: number
  text: string            // legacy — kept for compat
  messages: string        // JSON stringified ChatMessage[]
  selectionContext: string // JSON stringified — snapshot of original selection context
  title: string           // auto-generated, user-editable
}

export const aiTextProps: RecordProps<AITextShape> = {
  w: T.number,
  h: T.number,
  text: T.string,
  messages: T.string,
  selectionContext: T.string,
  title: T.string,
}
```

Update `getDefaultProps()`:

```typescript
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
```

- [ ] **Step 3: Add helper to parse messages with legacy compat**

Add above the class definition:

```typescript
function getMessages(shape: AITextShape): ChatMessage[] {
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
```

- [ ] **Step 4: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No TypeScript errors related to AITextProps.

- [ ] **Step 5: Commit**

```bash
git add src/types/canvas-ai.ts src/components/canvas/AITextShape.tsx
git commit -m "feat(ai-card): update shape data model with messages, selectionContext, title"
```

---

### Task 2: CSS Shimmer Animations

**Files:**
- Create: `src/components/canvas/ai-chat-card.css`

- [ ] **Step 1: Create the CSS file with shimmer animations and card styles**

```css
/* AI Chat Card — shimmer animations + layout styles */

/* CSS custom property for smooth angle animation */
@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

/* ── Card base ── */
.ai-card {
  position: relative;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  font-family: var(--font-family);
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.5;
  overflow: hidden;
}

/* ── Flowing border (conic-gradient rotation) ── */
.ai-card-shimmer-active::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: conic-gradient(from var(--angle), transparent 60%, var(--color-accent) 80%, transparent 100%);
  animation: border-flow 2s linear infinite;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  padding: 1.5px;
  z-index: -1;
  pointer-events: none;
}

@keyframes border-flow {
  to { --angle: 360deg; }
}

/* ── Wash shimmer (translucent gradient sweep) ── */
.ai-card-shimmer-active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
  background-size: 200% 100%;
  animation: wash-shimmer 1.5s ease-in-out infinite;
  pointer-events: none;
  z-index: 10;
}

@keyframes wash-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Wash drops to low opacity once tokens start arriving */
.ai-card-shimmer-streaming::after {
  opacity: 0.25;
}

/* ── Simple mode ── */
.ai-card-simple {
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-card-reply-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ai-card:hover .ai-card-reply-btn {
  opacity: 1;
}

.ai-card-reply-btn:hover {
  background: var(--color-bg);
  color: var(--color-accent);
}

/* ── Chat mode ── */
.ai-card-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ai-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-border);
  font-size: 11px;
  min-height: 32px;
}

.ai-card-title {
  flex: 1;
  font-weight: 500;
  color: var(--color-text);
  background: none;
  border: none;
  font-family: inherit;
  font-size: 11px;
  padding: 0;
  outline: none;
  cursor: text;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-card-title:focus {
  text-decoration: underline;
}

.ai-card-badge {
  font-size: 9px;
  color: var(--color-muted);
  background: var(--color-bg);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
}

.ai-card-minimize {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  background: none;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
}

.ai-card-minimize:hover {
  background: var(--color-bg);
}

/* ── Message area ── */
.ai-card-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-card-msg {
  max-width: 85%;
  font-size: 12px;
  line-height: 1.45;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-card-msg-assistant {
  align-self: flex-start;
  color: var(--color-muted);
}

.ai-card-msg-user {
  align-self: flex-end;
  background: var(--color-bg);
  color: var(--color-text);
}

/* ── Input bar ── */
.ai-card-input-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-top: 1px solid var(--color-border);
}

.ai-card-input {
  flex: 1;
  padding: 5px 8px;
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  font-size: 11px;
  font-family: var(--font-family);
  outline: none;
}

.ai-card-input:focus {
  border-color: var(--color-accent);
}

.ai-card-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
}

.ai-card-send:disabled {
  background: var(--color-bg);
  color: var(--color-muted);
  cursor: default;
}

.ai-card-send:not(:disabled) {
  background: var(--color-accent);
  color: #fff;
}
```

- [ ] **Step 2: Import the CSS in AITextShape.tsx**

Add at the top of `AITextShape.tsx`:

```typescript
import './ai-chat-card.css'
```

- [ ] **Step 3: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/ai-chat-card.css src/components/canvas/AITextShape.tsx
git commit -m "feat(ai-card): add shimmer animations and chat card CSS"
```

---

### Task 3: Simple Mode Component

**Files:**
- Modify: `src/components/canvas/AITextShape.tsx`

- [ ] **Step 1: Rewrite the `component` method to render simple mode**

Replace the existing `component` method in `AITextShapeUtil`. The full component method handles both modes, but this step focuses on simple mode:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react'
import { Reply } from 'lucide-react'
import type { ChatMessage } from '@/types/canvas-ai'
```

Add these imports at the top alongside existing imports.

Replace the `component` method:

```typescript
component(shape: AITextShape) {
  const messages = getMessages(shape)
  const isSimple = messages.length <= 1
  const isStreaming = messages.length > 0 &&
    messages[messages.length - 1].role === 'assistant' &&
    messages[messages.length - 1].text === ''

  if (isSimple) {
    return (
      <HTMLContainer>
        <SimpleMode
          shape={shape}
          messages={messages}
          isStreaming={isStreaming}
        />
      </HTMLContainer>
    )
  }

  return (
    <HTMLContainer>
      <ChatMode
        shape={shape}
        messages={messages}
        isStreaming={isStreaming}
      />
    </HTMLContainer>
  )
}
```

- [ ] **Step 2: Create the SimpleMode component**

Add below the `getMessages` helper, above the class:

```typescript
function SimpleMode({
  shape,
  messages,
  isStreaming,
}: {
  shape: AITextShape
  messages: ChatMessage[]
  isStreaming: boolean
}) {
  const text = messages[0]?.text || ''
  const hasContent = text.length > 0
  const shimmerClass = isStreaming
    ? 'ai-card-shimmer-active'
    : hasContent
      ? ''
      : 'ai-card-shimmer-active'

  // Determine shimmer state: no text yet = full shimmer, streaming = streaming class
  let className = 'ai-card ai-card-simple'
  if (!hasContent) {
    className += ' ai-card-shimmer-active'
  } else if (isStreaming) {
    className += ' ai-card-shimmer-active ai-card-shimmer-streaming'
  }

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
        <button className="ai-card-reply-btn" title="Reply">
          <Reply size={13} />
        </button>
      )}
    </div>
  )
}
```

Note: The reply button click handler will be wired in Task 6 when streaming is available — for now it's a visual placeholder.

- [ ] **Step 3: Create a stub ChatMode component**

Add below SimpleMode (will be fully implemented in Task 4):

```typescript
function ChatMode({
  shape,
  messages,
  isStreaming,
}: {
  shape: AITextShape
  messages: ChatMessage[]
  isStreaming: boolean
}) {
  return (
    <div
      className={`ai-card ai-card-chat${isStreaming ? ' ai-card-shimmer-active ai-card-shimmer-streaming' : ''}`}
      style={{
        width: shape.props.w,
        height: shape.props.h,
        pointerEvents: 'all',
      }}
    >
      <div className="ai-card-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`ai-card-msg ai-card-msg-${msg.role}`}>
            {msg.text || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/AITextShape.tsx
git commit -m "feat(ai-card): implement simple mode with shimmer states and reply button"
```

---

### Task 4: Chat Mode Component

**Files:**
- Modify: `src/components/canvas/AITextShape.tsx`

- [ ] **Step 1: Add remaining imports**

Add to the lucide-react import:

```typescript
import { Reply, Send, Minus } from 'lucide-react'
```

Add the AISparkleIcon import:

```typescript
import { AISparkleIcon } from './AISparkleIcon'
```

- [ ] **Step 2: Replace the stub ChatMode with the full implementation**

Replace the entire `ChatMode` function:

```typescript
function ChatMode({
  shape,
  messages,
  isStreaming,
}: {
  shape: AITextShape
  messages: ChatMessage[]
  isStreaming: boolean
}) {
  const [inputValue, setInputValue] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

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
          className="ai-card-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && inputValue.trim() && !isStreaming) {
              // Will dispatch send event in Task 6
              setInputValue('')
            }
          }}
          placeholder="Reply..."
          disabled={isStreaming}
        />
        <button
          className="ai-card-send"
          disabled={!inputValue.trim() || isStreaming}
        >
          <Send size={11} />
        </button>
      </div>
    </div>
  )
}
```

Note: The title input is read-only for now — editability and the send handler will be wired in Tasks 6 and 8.

- [ ] **Step 3: Update getGeometry for chat mode sizing**

In the `AITextShapeUtil` class, update `getGeometry`:

```typescript
getGeometry(shape: AITextShape) {
  const messages = getMessages(shape)
  const isChat = messages.length > 1
  return new Rectangle2d({
    width: shape.props.w,
    height: isChat ? Math.max(200, shape.props.h) : shape.props.h,
    isFilled: true,
  })
}
```

- [ ] **Step 4: Clean up unused constants**

Remove these constants that are no longer used (the CSS handles styling now):

```typescript
// Remove these:
const PADDING = 12
const BORDER_WIDTH = 3
const FONT_SIZE = 13
const LINE_HEIGHT = 1.5
const MAX_WIDTH = 320
```

- [ ] **Step 5: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/AITextShape.tsx
git commit -m "feat(ai-card): implement chat mode with header, messages, input bar"
```

---

### Task 5: API Route — SSE Streaming + Multi-Turn

**Files:**
- Modify: `src/app/api/canvas-ai/route.ts`
- Modify: `src/types/canvas-ai.ts`

- [ ] **Step 1: Add a streaming handler to the route**

Replace the entire `POST` function in `route.ts`:

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Multi-turn chat request
    if (body.messages && Array.isArray(body.messages)) {
      return handleChatStream(body as CanvasAIChatRequest)
    }

    // Legacy single-shot request
    return handleSingleShot(body as CanvasAIRequest)
  } catch (error) {
    console.error('Canvas AI error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Canvas AI failed' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Extract the existing logic into handleSingleShot**

Move the existing POST body into a function:

```typescript
async function handleSingleShot(body: CanvasAIRequest) {
  if (!body.message || !body.context || !body.canvasId) {
    return NextResponse.json(
      { error: 'message, context, and canvasId are required' },
      { status: 400 }
    )
  }

  const userMessage = buildUserMessage(body)
  const content: Anthropic.Messages.ContentBlockParam[] = [
    { type: 'text', text: userMessage },
  ]

  if (body.context.selectedImages?.urls.length) {
    for (const url of body.context.selectedImages.urls) {
      content.push({
        type: 'image' as const,
        source: { type: 'url' as const, url },
      })
    }
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: CANVAS_AI_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: CANVAS_AI_TOOLS,
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content }],
  })

  console.log(`[canvas-ai] tokens — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}`)

  const toolCalls: CanvasAIToolCall[] = []
  let textResponse: string | undefined

  for (const block of response.content) {
    if (block.type === 'tool_use') {
      toolCalls.push({
        name: block.name,
        input: block.input as Record<string, unknown>,
      })
    } else if (block.type === 'text' && block.text.trim()) {
      textResponse = block.text.trim()
    }
  }

  if (textResponse && !toolCalls.some((tc) => tc.name === 'place_text')) {
    toolCalls.push({
      name: 'place_text',
      input: { text: textResponse, position: 'near_selection' },
    })
    textResponse = undefined
  }

  const result: CanvasAIResponse = { toolCalls, textResponse }
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Implement the streaming chat handler**

Add the `handleChatStream` function and its import:

```typescript
import type { CanvasAIRequest, CanvasAIResponse, CanvasAIToolCall, CanvasAIChatRequest } from '@/types/canvas-ai'
```

```typescript
async function handleChatStream(body: CanvasAIChatRequest) {
  if (!body.messages?.length || !body.canvasId) {
    return NextResponse.json(
      { error: 'messages and canvasId are required' },
      { status: 400 }
    )
  }

  // Build multi-turn messages array for Claude
  const claudeMessages: Anthropic.Messages.MessageParam[] = []
  let originalContextNote = ''

  try {
    const origCtx = JSON.parse(body.originalContext)
    if (origCtx.selectionType && origCtx.selectionType !== 'none') {
      originalContextNote = `\nOriginal conversation context: ${origCtx.selectionType} selection`
      if (origCtx.selectedBoards?.names) {
        originalContextNote += ` — boards: ${origCtx.selectedBoards.names.join(', ')}`
      }
    }
  } catch {}

  // Build current context note
  let currentContextNote = ''
  if (body.currentContext?.selectionType && body.currentContext.selectionType !== 'none') {
    currentContextNote = `\nCurrent selection: ${body.currentContext.selectionType}`
  }

  for (const msg of body.messages) {
    if (msg.role === 'user') {
      let text = msg.text
      // Add context notes to the first user message
      if (claudeMessages.length === 0 && (originalContextNote || currentContextNote)) {
        text = `${text}${originalContextNote}${currentContextNote}`
      }
      claudeMessages.push({ role: 'user', content: text })
    } else {
      claudeMessages.push({ role: 'assistant', content: msg.text })
    }
  }

  // Include images from current context if available
  const lastUserIdx = claudeMessages.length - 1
  if (body.currentContext?.selectedImages?.urls.length && claudeMessages[lastUserIdx]?.role === 'user') {
    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: claudeMessages[lastUserIdx].content as string },
    ]
    for (const url of body.currentContext.selectedImages.urls) {
      content.push({
        type: 'image' as const,
        source: { type: 'url' as const, url },
      })
    }
    claudeMessages[lastUserIdx] = { role: 'user', content }
  }

  // Stream response via SSE
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: CANVAS_AI_SYSTEM + '\n\nYou are in a multi-turn conversation. Respond naturally — use place_text only if you want to put something on the canvas separate from the chat. Otherwise just reply with text.',
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: claudeMessages,
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const response = await stream.finalMessage()

        // For streaming, we process events as they arrive
        stream.on('text', (text) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`))
        })

        stream.on('end', () => {
          // Check for tool calls in the final message
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name: block.name, input: block.input })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Stream failed'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

Wait — the Anthropic SDK streaming API needs to be used correctly. Let me fix the streaming approach:

```typescript
async function handleChatStream(body: CanvasAIChatRequest) {
  if (!body.messages?.length || !body.canvasId) {
    return NextResponse.json(
      { error: 'messages and canvasId are required' },
      { status: 400 }
    )
  }

  // Build multi-turn messages array for Claude
  const claudeMessages: Anthropic.Messages.MessageParam[] = []
  let originalContextNote = ''

  try {
    const origCtx = JSON.parse(body.originalContext)
    if (origCtx.selectionType && origCtx.selectionType !== 'none') {
      originalContextNote = `\nOriginal conversation context: ${origCtx.selectionType} selection`
      if (origCtx.selectedBoards?.names) {
        originalContextNote += ` — boards: ${origCtx.selectedBoards.names.join(', ')}`
      }
    }
  } catch {}

  let currentContextNote = ''
  if (body.currentContext?.selectionType && body.currentContext.selectionType !== 'none') {
    currentContextNote = `\nCurrent selection: ${body.currentContext.selectionType}`
  }

  for (const msg of body.messages) {
    if (msg.role === 'user') {
      let text = msg.text
      if (claudeMessages.length === 0 && (originalContextNote || currentContextNote)) {
        text = `${text}${originalContextNote}${currentContextNote}`
      }
      claudeMessages.push({ role: 'user', content: text })
    } else {
      claudeMessages.push({ role: 'assistant', content: msg.text })
    }
  }

  // Include images from current context if available
  const lastUserIdx = claudeMessages.length - 1
  if (body.currentContext?.selectedImages?.urls.length && claudeMessages[lastUserIdx]?.role === 'user') {
    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: claudeMessages[lastUserIdx].content as string },
    ]
    for (const url of body.currentContext.selectedImages.urls) {
      content.push({
        type: 'image' as const,
        source: { type: 'url' as const, url },
      })
    }
    claudeMessages[lastUserIdx] = { role: 'user', content }
  }

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: CANVAS_AI_SYSTEM + '\n\nYou are in a multi-turn conversation. Respond naturally with text. Do NOT use tools unless the user explicitly asks for a canvas action (rename, group, delete, extract DNA).',
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: claudeMessages,
        })

        stream.on('text', (text) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`))
        })

        const finalMessage = await stream.finalMessage()

        console.log(`[canvas-ai-chat] tokens — input: ${finalMessage.usage.input_tokens}, output: ${finalMessage.usage.output_tokens}`)

        // Check for tool calls
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name: block.name, input: block.input })}\n\n`))
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        controller.close()
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Stream failed'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 4: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/canvas-ai/route.ts src/types/canvas-ai.ts
git commit -m "feat(ai-card): add SSE streaming endpoint and multi-turn conversation support"
```

---

### Task 6: Executor — streamToShape + Immediate Shape Creation

**Files:**
- Modify: `src/lib/canvas-ai-executor.ts`

- [ ] **Step 1: Add the streamToShape function**

Add this function at the bottom of the file:

```typescript
import type { ChatMessage, SSEEvent, CanvasAIChatRequest } from '@/types/canvas-ai'

/**
 * Stream an SSE response into a shape's messages prop.
 * Creates or updates the last assistant message with incoming text deltas.
 * Returns any tool calls received during the stream.
 */
export async function streamToShape(
  editor: Editor,
  shapeId: TLShapeId,
  stream: ReadableStream<Uint8Array>
): Promise<{ toolCalls: CanvasAIToolCall[] }> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const toolCalls: CanvasAIToolCall[] = []
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE events (separated by double newlines)
      const events = buffer.split('\n\n')
      buffer = events.pop() || '' // Keep incomplete event in buffer

      for (const event of events) {
        const line = event.trim()
        if (!line.startsWith('data: ')) continue

        try {
          const data: SSEEvent = JSON.parse(line.slice(6))

          if (data.type === 'text_delta') {
            // Update the last assistant message with the new text
            const shape = editor.getShape(shapeId) as AITextShape | undefined
            if (!shape) continue

            const messages: ChatMessage[] = JSON.parse(shape.props.messages)
            const lastMsg = messages[messages.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.text += data.text
              editor.updateShape({
                id: shapeId,
                type: 'ai-text',
                props: { messages: JSON.stringify(messages) },
              })
            }
          } else if (data.type === 'tool_call') {
            toolCalls.push({ name: data.name, input: data.input })
          } else if (data.type === 'error') {
            console.error('[streamToShape] SSE error:', data.message)
          }
          // 'done' type — loop will end naturally
        } catch {
          // Skip malformed events
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { toolCalls }
}
```

- [ ] **Step 2: Add createAIShape helper for immediate shape creation**

Add this exported function:

```typescript
/**
 * Create an ai-text shape immediately with an empty assistant message.
 * Returns the shape ID for streaming updates.
 */
export function createAIShape(
  editor: Editor,
  position: 'near_selection' | { x: number; y: number },
  selectionContext: string
): TLShapeId {
  let x: number
  let y: number

  if (position === 'near_selection') {
    const bounds = editor.getSelectionPageBounds()
    if (bounds) {
      x = bounds.maxX + AI_TEXT_OFFSET
      y = bounds.minY
    } else {
      const viewport = editor.getViewportPageBounds()
      x = viewport.midX
      y = viewport.midY
    }
  } else {
    x = position.x
    y = position.y
  }

  const shapeId = createShapeId()
  const initialMessage: ChatMessage[] = [
    { role: 'assistant', text: '', timestamp: Date.now() },
  ]

  editor.createShape({
    id: shapeId,
    type: 'ai-text',
    x,
    y,
    props: {
      w: 360,
      h: 40,
      text: '',
      messages: JSON.stringify(initialMessage),
      selectionContext,
      title: '',
    },
  })

  return shapeId
}
```

- [ ] **Step 3: Add the AITextShape import**

Add at the top of the file:

```typescript
import type { AITextShape } from '@/components/canvas/AITextShape'
```

- [ ] **Step 4: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/canvas-ai-executor.ts
git commit -m "feat(ai-card): add streamToShape and createAIShape for streaming updates"
```

---

### Task 7: Wire AIActionBar to Streaming Flow

**Files:**
- Modify: `src/components/canvas/AIActionBar.tsx`

- [ ] **Step 1: Update imports**

Add new imports:

```typescript
import { createAIShape, streamToShape } from '@/lib/canvas-ai-executor'
import type { CanvasAIResponse, AISuggestion, CanvasAIChatRequest } from '@/types/canvas-ai'
```

- [ ] **Step 2: Rewrite sendMessage to use streaming for text responses**

Replace the `sendMessage` callback. The key change: instead of waiting for a full JSON response and then creating a shape, we create the shape immediately and stream text into it. Tool-only responses (rename, group, delete, extract) still use the original single-shot endpoint.

```typescript
const sendMessage = useCallback(async (message: string) => {
  if (!message.trim() || isProcessing) return

  setIsProcessing(true)
  setThinkingStatus('Thinking...')
  setExpanded(false)
  setInputValue('')

  try {
    const context = buildSelectionContext(editor)

    // First, try the single-shot endpoint (for tool-use actions)
    const res = await fetch('/api/canvas-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context, canvasId }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Request failed')
    }

    const data: CanvasAIResponse = await res.json()
    if (data.error) throw new Error(data.error)

    // Check if response has place_text — if so, use streaming instead
    const placeTextCall = data.toolCalls.find((tc) => tc.name === 'place_text')
    const otherToolCalls = data.toolCalls.filter((tc) => tc.name !== 'place_text')

    // Execute non-text tool calls first
    if (otherToolCalls.length > 0) {
      setThinkingStatus('Executing...')
      const results = await executeToolCalls(editor, otherToolCalls, canvasId)
      for (const result of results) {
        if (result.triggerExtractDna && onExtractDna) onExtractDna()
        if (result.needsDeleteConfirmation) setShowDeleteConfirm(true)
      }
    }

    // For text responses, create shape with the text
    if (placeTextCall) {
      const textInput = placeTextCall.input as { text: string; position: string | { x: number; y: number } }
      const selectionCtxJson = JSON.stringify(context)
      const shapeId = createAIShape(editor, 'near_selection', selectionCtxJson)

      // Update shape with the full text (single-shot doesn't stream yet)
      const msgs = [{ role: 'assistant' as const, text: textInput.text, timestamp: Date.now() }]
      editor.updateShape({
        id: shapeId,
        type: 'ai-text' as const,
        props: { messages: JSON.stringify(msgs) },
      })
    }
  } catch (error) {
    console.error('Canvas AI error:', error)
    const bounds = editor.getSelectionPageBounds()
    if (bounds) {
      editor.createShape({
        id: createShapeId(),
        type: 'ai-text',
        x: bounds.maxX + 24,
        y: bounds.minY,
        props: {
          w: 280,
          h: 40,
          text: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
          messages: '[]',
          selectionContext: '{}',
          title: '',
        },
      })
    }
  } finally {
    setIsProcessing(false)
    setThinkingStatus('')
  }
}, [editor, canvasId, isProcessing, onExtractDna])
```

Note: The first-request flow still uses the single-shot endpoint since `tool_choice: { type: 'any' }` is set. The streaming endpoint is used for follow-up messages in chat mode (wired in the next step within the shape component itself). A future optimization would stream the first request too.

- [ ] **Step 3: Update error shape creation to include new props**

Already done in the code above — the error shape now includes `messages: '[]'`, `selectionContext: '{}'`, and `title: ''`.

- [ ] **Step 4: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/AIActionBar.tsx
git commit -m "feat(ai-card): wire AIActionBar to create shapes with streaming support"
```

---

### Task 8: Wire Chat Mode Send + Streaming + Reply Button

**Files:**
- Modify: `src/components/canvas/AITextShape.tsx`

This is the most integration-heavy task. It wires the chat input's send button and the simple mode reply button to the streaming endpoint.

- [ ] **Step 1: Add streaming imports and a sendChatMessage helper**

Add imports at the top of AITextShape.tsx:

```typescript
import { useEditor } from 'tldraw'
// Note: useEditor is already imported from tldraw — just ensure it's in the destructured list
```

Add a helper function above the component definitions:

```typescript
import { buildSelectionContext } from '@/lib/selection-context'
import { streamToShape, executeToolCalls } from '@/lib/canvas-ai-executor'
import type { CanvasAIChatRequest, ChatMessage, CanvasAIToolCall } from '@/types/canvas-ai'

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
  const { toolCalls } = await streamToShape(editor, shapeId as TLShapeId, res.body)

  // Execute any tool calls
  if (toolCalls.length > 0) {
    await executeToolCalls(editor, toolCalls, canvasId)
  }
}
```

- [ ] **Step 2: Update ChatMode to call sendChatMessage**

Add `useEditor` to ChatMode and wire the send handler:

```typescript
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
    // canvasId is stored... we need to get it from somewhere
    // For now, extract from URL or pass via a different mechanism
    sendChatMessage(editor, shape.id as TLShapeId, text, getCanvasId())
  }, [editor, shape.id, inputValue, isStreaming])

  // ... rest of the component unchanged
```

Wait — we need the `canvasId`. The shape component doesn't have direct access to it. We can extract it from the URL path since the canvas page URL contains it.

Add this helper:

```typescript
function getCanvasId(): string {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/\/canvas\/([^/]+)/)
  return match?.[1] || ''
}
```

Now update the `handleSend` and key handlers:

In ChatMode, replace the send button and input's onKeyDown:

```typescript
const handleSend = useCallback(() => {
  if (!inputValue.trim() || isStreaming) return
  const text = inputValue.trim()
  setInputValue('')
  sendChatMessage(editor, shape.id as TLShapeId, text, getCanvasId())
}, [editor, shape.id, inputValue, isStreaming])
```

Update the input `onKeyDown`:

```typescript
onKeyDown={(e) => {
  e.stopPropagation()
  if (e.key === 'Enter' && inputValue.trim() && !isStreaming) {
    handleSend()
  }
}}
```

Update the send button:

```typescript
<button
  className="ai-card-send"
  disabled={!inputValue.trim() || isStreaming}
  onClick={handleSend}
>
  <Send size={11} />
</button>
```

- [ ] **Step 3: Wire the SimpleMode reply button to transition to chat mode**

Update SimpleMode to use the editor and handle reply:

```typescript
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
    // Transition to chat mode by resizing and focusing
    editor.updateShape({
      id: shape.id,
      type: 'ai-text',
      props: { h: 280 },
    })
    // Add a temporary flag — the ChatMode input will auto-focus
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
```

Wait — clicking reply doesn't add a user message, it just resizes. But the mode switch depends on `messages.length > 1`. The reply button should transition the user into chat mode by showing the input. We need a different approach: we need the component to track whether it's in "ready to chat" mode even with 1 message.

Simpler approach: the reply button doesn't change shape data — it uses local state to show the chat UI temporarily:

Actually, the simplest approach: update the component method to pass a `forceChat` state. But since `component` re-renders on shape changes, we can just make reply add a dummy entry. No — let's keep it clean.

Best approach: The reply button just resizes the shape to chat height (280), and we modify the mode check: if `h >= 200` and there's at least 1 message, show chat mode. This way clicking reply triggers chat UI with the input visible.

Actually even simpler: modify the `component` method to check if messages.length >= 1 AND shape height >= 200 for chat mode. The reply button just resizes to 280.

Let me revise the approach. In the `component` method:

```typescript
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
```

And the reply button just does:
```typescript
editor.updateShape({ id: shape.id, type: 'ai-text', props: { h: 280 } })
```

This transitions to chat mode showing the input. The user types and sends, which adds messages and goes through the streaming flow.

- [ ] **Step 4: Auto-focus chat input on mount**

In ChatMode, add an `inputRef` and auto-focus:

```typescript
const inputRef = useRef<HTMLInputElement>(null)

useEffect(() => {
  // Auto-focus input when entering chat mode
  setTimeout(() => inputRef.current?.focus(), 100)
}, [])
```

Add `ref={inputRef}` to the input element.

- [ ] **Step 5: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/AITextShape.tsx
git commit -m "feat(ai-card): wire chat send, reply button, and streaming into shape component"
```

---

### Task 9: Title Generation

**Files:**
- Modify: `src/components/canvas/AITextShape.tsx`

- [ ] **Step 1: Add title generation after first exchange**

Add a function to generate title via a lightweight API call:

```typescript
async function generateTitle(
  editor: ReturnType<typeof useEditor>,
  shapeId: TLShapeId,
  messages: ChatMessage[]
) {
  if (messages.length < 2) return // Need at least one exchange

  try {
    const summary = messages
      .slice(0, 4)
      .map((m) => `${m.role}: ${m.text.slice(0, 100)}`)
      .join('\n')

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
  } catch {
    // Title generation is best-effort
  }
}
```

- [ ] **Step 2: Create the title generation API route**

Create file `src/app/api/canvas-ai/title/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const { summary } = await request.json()

    if (!summary) {
      return NextResponse.json({ error: 'summary is required' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `Generate a 2-4 word title for this conversation. Return ONLY the title, nothing else.\n\n${summary}`,
        },
      ],
    })

    const title = response.content[0]?.type === 'text'
      ? response.content[0].text.trim().replace(/^["']|["']$/g, '')
      : ''

    return NextResponse.json({ title })
  } catch (error) {
    console.error('Title generation error:', error)
    return NextResponse.json({ title: '' })
  }
}
```

- [ ] **Step 3: Call generateTitle after streaming completes**

In the `sendChatMessage` function, add title generation after stream completes:

After `await streamToShape(...)` and before tool call execution:

```typescript
// Generate title if this is the first exchange (2 messages: user + assistant)
const updatedShape = editor.getShape(shapeId) as AITextShape | undefined
if (updatedShape) {
  const updatedMsgs: ChatMessage[] = JSON.parse(updatedShape.props.messages)
  if (updatedMsgs.length === 2 && !updatedShape.props.title) {
    // Fire and forget — don't await
    generateTitle(editor, shapeId as TLShapeId, updatedMsgs)
  }
}
```

Wait — the first message from AIActionBar creates a shape with 1 assistant message, not via `sendChatMessage`. Title generation should happen after the first *follow-up* exchange (when there are 3+ messages: original assistant + user + assistant reply). Let me adjust:

```typescript
// Generate title after first follow-up completes (3 messages = original + user + reply)
const updatedShape = editor.getShape(shapeId) as AITextShape | undefined
if (updatedShape && !updatedShape.props.title) {
  const updatedMsgs: ChatMessage[] = JSON.parse(updatedShape.props.messages)
  if (updatedMsgs.length >= 3) {
    generateTitle(editor, shapeId as TLShapeId, updatedMsgs)
  }
}
```

- [ ] **Step 4: Make title editable in ChatMode header**

In the ChatMode component, replace the read-only title input with an editable one:

```typescript
const [editingTitle, setEditingTitle] = useState(false)
const [titleValue, setTitleValue] = useState(shape.props.title || 'Chat')

// Sync title from shape props
useEffect(() => {
  if (!editingTitle) {
    setTitleValue(shape.props.title || 'Chat')
  }
}, [shape.props.title, editingTitle])

const handleTitleBlur = useCallback(() => {
  setEditingTitle(false)
  if (titleValue.trim() && titleValue !== shape.props.title) {
    editor.updateShape({
      id: shape.id,
      type: 'ai-text',
      props: { title: titleValue.trim() },
    })
  }
}, [editor, shape.id, shape.props.title, titleValue])
```

Replace the title input in JSX:

```typescript
<input
  className="ai-card-title"
  value={titleValue}
  onChange={(e) => { setEditingTitle(true); setTitleValue(e.target.value) }}
  onBlur={handleTitleBlur}
  onKeyDown={(e) => {
    e.stopPropagation()
    if (e.key === 'Enter') e.currentTarget.blur()
  }}
  title={titleValue}
/>
```

- [ ] **Step 5: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/AITextShape.tsx src/app/api/canvas-ai/title/route.ts
git commit -m "feat(ai-card): add auto-generated editable titles via background Haiku call"
```

---

### Task 10: Auto-Size Simple Mode Height

**Files:**
- Modify: `src/components/canvas/AITextShape.tsx`

- [ ] **Step 1: Add auto-sizing for simple mode cards**

In SimpleMode, add a ref-based height measurement so the shape fits its content:

```typescript
function SimpleMode({ shape, messages, isStreaming }: { ... }) {
  const editor = useEditor()
  const contentRef = useRef<HTMLDivElement>(null)
  const text = messages[0]?.text || ''
  const hasContent = text.length > 0

  // Auto-size height to fit content
  useEffect(() => {
    if (!contentRef.current || !hasContent) return
    const measured = contentRef.current.scrollHeight
    if (Math.abs(measured - shape.props.h) > 2) {
      editor.updateShape({
        id: shape.id,
        type: 'ai-text',
        props: { h: measured },
      })
    }
  }, [editor, shape.id, shape.props.h, text, hasContent])

  // ... rest unchanged, but add ref={contentRef} to the outer div
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/AITextShape.tsx
git commit -m "feat(ai-card): auto-size simple mode height to fit content"
```

---

## Verification Checklist

After all tasks are complete:

1. [ ] **Build passes** — `npx next build` completes without errors
2. [ ] **Simple mode renders** — AI response creates a card with subtle border, text, hover reply button
3. [ ] **Shimmer activates** — While waiting for first token, both flowing border and wash shimmer are visible
4. [ ] **Shimmer transitions** — Once tokens arrive, wash drops to ~25% opacity. On completion, both stop.
5. [ ] **Reply button works** — Clicking reply transitions to chat mode with input focused
6. [ ] **Chat mode renders** — Header (sparkle + title + badge + minimize), scrollable messages, input bar
7. [ ] **Follow-up sends** — Typing + Enter sends user message, streams assistant response via SSE
8. [ ] **Auto-scroll** — New messages scroll to bottom unless user scrolled up
9. [ ] **Title generates** — After first follow-up, a 2-4 word title appears in header
10. [ ] **Title editable** — Clicking title allows inline editing
11. [ ] **Minimize works** — Collapse to simple mode appearance, double-click or reply to expand
12. [ ] **Legacy compat** — Old shapes with `text` prop still render correctly
13. [ ] **SSE endpoint** — Multi-turn requests stream back text deltas correctly
14. [ ] **Tool calls in chat** — If user asks to rename/group/delete in chat, tools still execute
