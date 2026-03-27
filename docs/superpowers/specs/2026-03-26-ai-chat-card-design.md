# AI Chat Card — Design Spec

## Goal

Replace the static `ai-text` shape with a dual-mode component: a clean text card for one-shot AI responses that upgrades to a mini chatbot when the user replies. Add streaming responses and a flowing border + wash shimmer effect during AI processing.

## Architecture

Single tldraw custom shape type (`ai-text`) with two render modes determined by message count. Simple mode (1 message) looks like a clean card with a reply button. Chat mode (2+ messages) renders a scrollable conversation with an input field. The API switches from JSON to SSE streaming so users see tokens arrive in real-time.

## 1. Shape Data Model

### Props

```typescript
interface AITextProps {
  w: number           // default 360
  h: number           // simple mode: auto-sized to content; chat mode: 280 default, user-resizable
  messages: string    // JSON stringified Message[]
  selectionContext: string  // JSON stringified — snapshot of original selection context
  title: string       // auto-generated, user-editable conversation title
}

interface Message {
  role: 'assistant' | 'user'
  text: string
  timestamp: number   // Date.now()
}
```

### Migration from legacy `text` prop

The component includes a compat path: if a shape has the old `text` prop but no `messages`, render it as a single assistant message. The prop validators accept both old and new formats. No data migration needed — shapes upgrade lazily on next edit.

## 2. Simple Mode (1 message)

### Appearance

- **Card:** Full subtle border (`1px solid var(--color-border)`), `border-radius: var(--radius-md)`, surface background, card shadow.
- **Text:** Assistant message rendered with `pre-wrap`, same font/size as current `ai-text` (13px, 1.5 line-height).
- **Reply button:** Bottom-right of the card. Subtle — icon only (reply arrow), visible on hover. Clicking transitions to chat mode by resizing the card to 360x280 and focusing the input.
- **Title:** Not shown in simple mode — only appears after upgrade to chat mode.

### Creation flow (streaming)

1. User triggers AI (toolbar, context menu, suggestion chip).
2. Shape is created immediately at the target position with an empty assistant message.
3. Flowing border shimmer + wash shimmer activate at full opacity.
4. API response streams in via SSE. Each text delta updates the message in the shape props.
5. Once first token arrives, wash shimmer drops to ~20-30% opacity. Flowing border stays full.
6. Streaming completes — both effects stop, border settles to static.
7. If the response completes very fast (<500ms), the user just sees the final text with no visible streaming.

## 3. Chat Mode (2+ messages)

### Layout (top to bottom)

- **Header bar:** Sparkle icon + editable title + message count badge + minimize button.
  - Title: Auto-generated after first exchange (background Haiku call, 2-4 words). User can click to edit inline.
  - Minimize: Collapses back to simple mode appearance (shows last message only) while preserving full history.
- **Message area:** Scrollable region filling remaining space.
  - Assistant messages: Left-aligned, muted text color.
  - User messages: Right-aligned, subtle accent background.
  - Auto-scrolls to bottom on new messages. If user has scrolled up, respects their position.
- **Input bar:** Fixed at bottom. Text input + send button. `stopPropagation` on keystrokes to prevent tldraw handling. Same styling as the existing AI input (accent border on focus).

### Sending a follow-up

1. User types message, presses Enter or clicks send.
2. User message appends to messages array immediately (optimistic update).
3. Empty assistant message appended. Flowing border + wash shimmer activate.
4. API call fires with:
   - Full message history from the shape
   - Original `selectionContext` (stored in shape props)
   - Current live selection context (built fresh from editor state)
5. AI response streams in, updating the last assistant message in real-time.
6. Shimmer fades, wash drops to low opacity during streaming, both stop on completion.

### Resizing

- `canResize: true` (already supported).
- Min size: 240w x 200h.
- Message area fills available space. Input bar stays pinned to bottom.

## 4. Flowing Border + Wash Shimmer

### Flowing border

A `conic-gradient` with the accent color that rotates around the card's border. Implemented with a `::before` pseudo-element and CSS `@property --angle` for smooth animation.

```
@property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }

.ai-card-shimmer-active::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: conic-gradient(from var(--angle), transparent 60%, var(--color-accent) 80%, transparent 100%);
  animation: border-flow 2s linear infinite;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  padding: 1.5px;
  z-index: -1;
}

@keyframes border-flow {
  to { --angle: 360deg; }
}
```

### Wash shimmer

A translucent gradient sweep across the card surface, overlaid on the content.

```
.ai-card-shimmer-active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
  background-size: 200% 100%;
  animation: wash-shimmer 1.5s ease-in-out infinite;
  pointer-events: none;
}

@keyframes wash-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### States

| State | Flowing border | Wash shimmer |
|-------|---------------|--------------|
| Waiting for first token | Full intensity | Full opacity |
| Streaming (tokens arriving) | Full intensity | ~20-30% opacity |
| Complete / Idle | Off (static border) | Off |

Toggle via CSS class `ai-shimmer-active` and `ai-shimmer-streaming` on the card wrapper.

## 5. API & Executor Changes

### Streaming endpoint

The existing `/api/canvas-ai` route switches from JSON response to SSE streaming:

- `anthropic.messages.create()` → `anthropic.messages.stream()`
- Returns a `ReadableStream` with SSE events
- Event types:
  - `text_delta` — partial text content
  - `tool_call` — complete tool call (rename, group, etc.)
  - `done` — stream complete
  - `error` — error occurred

### Executor changes

- `executePlaceText` creates the shape immediately with an empty assistant message, returns the shape ID.
- New `streamToShape(editor, shapeId, stream)` function reads SSE events and updates the shape's messages prop as text deltas arrive.
- Tool calls (rename, group, delete, extract_dna) still execute after the full response completes — only text responses stream.

### Multi-turn conversation

For follow-up messages in chat mode:
- Client sends full message history + both selection contexts (original + current) to the same `/api/canvas-ai` endpoint.
- Route builds a proper multi-turn `messages` array for Claude (alternating user/assistant roles).
- The system prompt + tools remain the same.
- Response streams back identically.

### Title generation

After the first AI response completes, a lightweight background call to Haiku generates a 2-4 word conversation title. Updates the shape's `title` prop. User can edit the title anytime by clicking on it in the header.

## 6. Selection Context in Chat Mode

Each message in the conversation can reference canvas state:

- **Original context:** Stored in `selectionContext` prop at card creation time. Persists for the life of the conversation. Tells the AI what the conversation was originally about.
- **Current context:** Built fresh from `editor.getSelectedShapes()` on each message send. Allows the user to select new items and reference them ("compare this to the first one").
- **Fallback:** If nothing is currently selected when sending a follow-up, only the original context is sent.

The API route receives both and includes them in the user message:
```
Previous context: [original selectionContext summary]
Current selection: [live selection summary]
User message: "..."
```

## 7. File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/canvas/AITextShape.tsx` | **Major rewrite** | Dual-mode component (simple + chat), streaming support, shimmer effects |
| `src/components/canvas/ai-chat-card.css` | **Create** | Shimmer animations, chat layout styles |
| `src/app/api/canvas-ai/route.ts` | **Modify** | Switch to SSE streaming, support multi-turn conversations |
| `src/lib/canvas-ai-executor.ts` | **Modify** | Create shape immediately, stream updates, new `streamToShape` function |
| `src/components/canvas/AIActionBar.tsx` | **Modify** | Wire send to create shape + start stream instead of waiting for full response |

## 8. Out of Scope (Future)

- Full chatbot panel (canvas-wide) — chat card's "open in chatbot" button is a placeholder until that exists.
- Board-level shimmer effect (shimmer on the referenced board, not just the card).
- Image upload in the chat input.
- Board reference selector icon in input.
- External storage for very long conversations (Supabase).
