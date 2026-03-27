# Canvas AI — Design Spec

**Date:** 2026-03-26
**Goal:** Add an AI assistant that lives on the canvas — available on any selection, responds with canvas-native actions and text, and serves as the primary way users interact with AI in Grain.
**Scope:** New selection UI, API route with tool-use architecture, canvas response rendering, chat window fallback, image generation and web search integrations.

## Problem

Grain's AI currently only activates in two places: the Organize button (bulk grouping) and the DNA panel (extraction + export). All other canvas interactions are manual. Users have no way to ask questions about their content, request AI actions on specific selections, or get proactive suggestions — the AI is invisible until you explicitly open one of those two surfaces.

The PRD specifies a cursor AI chatbox (Section 5.4) but the real opportunity is bigger: make AI the primary interaction layer on the canvas. Every selection is an opportunity for AI to help.

## Principles

1. **Canvas-first.** AI responses live on the canvas as native objects (text, images, shapes), not in a sidebar. The canvas is the workspace — the AI works in the same space.
2. **Always available.** AI is accessible on any selection — single image, single board, multi-select, drawn shapes. Not gated behind multi-select.
3. **Suggest, don't demand.** Contextual suggestions appear on hover, but the user can always type a custom message. The AI adapts to intent, not the other way around.
4. **Actions over answers.** The AI should do things on the canvas, not just describe what it would do. Group, rename, rearrange, generate — then let the user undo if needed.
5. **Undo is the safety net.** All AI actions go through tldraw's editor, so Cmd+Z undoes them naturally. This allows the AI to be bold without being dangerous.

## Architecture: Tool-Use Agent

Claude API with function calling. We define canvas tools, send selection context + user message, and Claude decides which tools to call.

### API Route

`POST /api/canvas-ai`

**Request:**
```typescript
{
  message: string                    // user's input or suggestion label
  context: {
    selectionType: 'image' | 'board' | 'mixed' | 'shapes' | 'none'
    selectedImages?: {               // if images selected
      urls: string[]
      ungrouped: boolean
      boardName?: string             // if images are inside a board
    }
    selectedBoards?: {               // if boards selected
      names: string[]
      dnaSummaries?: string[]        // brief DNA direction per board
    }
    canvasOverview: {                // lightweight canvas state
      totalBoards: number
      totalUngroupedImages: number
      boardNames: string[]
    }
  }
  conversationId?: string            // for chat window follow-ups
  canvasId: string
}
```

**System prompt:** Tells Claude it is a canvas AI assistant for a design inspiration tool. It can take actions on the canvas via tools. Responses should be concise — it's a collaborator, not a lecturer. When responding with text, keep it brief and useful. When taking actions, do them and confirm briefly.

### Tool Definitions

**Phase 1 — Foundation:**

| Tool | Parameters | What it does |
|------|-----------|-------------|
| `place_text` | `text`, `position` (near_selection / specific x,y) | Write text on canvas near the selection |
| `group_images` | `name` | Group selected ungrouped images into a named board |
| `rename_board` | `newName` | Rename the selected board |
| `delete_selection` | `confirm: boolean` | Delete selected items (requires confirmation) |
| `analyze_selection` | none | Describe what's selected, return text to place on canvas |
| `extract_dna` | none | Trigger DNA extraction on selected board |

**Phase 2 — Canvas Power:**

| Tool | Parameters | What it does |
|------|-----------|-------------|
| `merge_boards` | `targetName` | Merge 2+ selected boards into one |
| `split_board` | `criteria`, `nameA`, `nameB` | Split a board into two based on criteria |
| `rearrange` | `strategy` (grid / cluster / spread) | Reorganize selected items spatially |
| `create_shape` | `type` (rect / circle / arrow / line), `position`, `size` | Place a shape on canvas |
| `move_to` | `target` (board name or coordinates) | Move selected items to a board or position |

**Phase 3 — Research & Generation:**

| Tool | Parameters | What it does |
|------|-----------|-------------|
| `search_images` | `query`, `count` (default 6) | Search Unsplash/Pexels, place results on canvas |
| `generate_image` | `prompt`, `style_context` | Call Flux via Replicate, place result on canvas |
| `find_similar` | none | Use selection context to search for visually similar images |

**Phase 4 — Polish:**

| Tool | Parameters | What it does |
|------|-----------|-------------|
| `clean_up_drawing` | none | Straighten lines, snap angles, convert to clean SVG |

### Response Handling

- **Text responses** → `place_text` tool call, streamed progressively onto canvas
- **Tool calls** → executed against tldraw's `editor` API
- **Multiple tool calls** → executed sequentially, each result appears on canvas
- **Destructive actions** → confirmation prompt appears inline near selection before executing: "This will merge 2 boards. Continue? [Yes] [Cancel]"
- **Errors** → brief error text placed near selection: "Couldn't find similar images. Try a different board."

## Selection UI — The AI Action Bar

### What Changes

tldraw's default selection toolbar is replaced with a custom minimal bar:
- **Download icon** — quick image save (stays from current tldraw toolbar)
- **AI sparkle icon** — gateway to all AI interaction

All other default tldraw selection actions are removed.

### AI Icon Behavior

**Default state:** Small sparkle icon in the floating selection bar.

**On hover:** Expands into a panel showing:
- 2-3 contextual suggestion chips (each with a small sparkle icon)
- A text input field: "Ask AI..."

**On click (suggestion chip):** Executes that suggestion.

**On submit (text input):** Sends freeform message to Claude with selection context.

**Dismisses on:** Click away, Escape, or after AI completes an action.

### Contextual Suggestions

Suggestions change based on what's selected. Each suggestion has a sparkle icon prefix.

| Selection | Suggestions |
|-----------|------------|
| 1 image (ungrouped) | "What is this?" · "Find similar" · "Describe" |
| 1 image (in a board) | "Find similar" · "Remove from board" · "Describe" |
| 2+ ungrouped images | "Group as board" · "What do these have in common?" |
| 1 board | "Extract DNA" · "Rename" · "Find similar images" |
| 2+ boards | "Compare" · "Merge" · "What's different?" |
| Drawn shapes | "Clean this up" · "Turn into wireframe" |

### Right-Click Context Menu

Custom right-click menu on any selection includes an "Ask AI..." option with sparkle icon. Opens the expanded AI action bar with the input field focused.

### Positioning

Floats above the selection. Uses `editor.getSelectionPageBounds()` to position in viewport coordinates — same approach as the current `SelectionActionBar`. Flips position if near viewport edges (same edge-detection logic from PRD Section 11.5).

## Thinking & Progress Indicators

Something visible must change within 200ms of user sending a message. The user must always know what the AI is doing and where it's doing it.

### Flow

```
User sends message
        ↓
Thinking indicator replaces AI action bar at selection point
(pulsing sparkle icon + "Thinking..." text)
        ↓
AI starts executing tools
Indicator updates: "Grouping images..." / "Searching..." / "Writing..."
        ↓
Results appear on canvas
        ↓
Indicator disappears
```

### For text responses:

Text block appears on canvas immediately with streaming — characters appear progressively as they come from the API. User sees the response being "written" in real-time.

### For longer operations (image gen, web search):

A progress card appears on canvas near the selection:
- Small card styled like a Grain element
- Sparkle icon + status text: "Generating image..."
- Subtle pulse animation
- When complete, card transforms into / is replaced by the result

## AI Responses on Canvas

### Text Responses

- tldraw text shape, styled with Grain tokens
- Font: `--font-family` (Bricolage Grotesque), 13px, `--color-muted`
- Positioned near selection with offset to avoid overlap
- Subtle left border or sparkle prefix in `--color-accent` to distinguish AI text from user text
- Fully native canvas object after placement — selectable, movable, deletable

### Created Objects (shapes, images)

- Placed near selection with comfortable spacing
- Become regular canvas objects immediately — no special treatment
- User can move, resize, delete like anything else

### Ephemeral vs Persistent

- **Quick answers** (descriptions, analysis) → text on canvas, user deletes if unneeded
- **Canvas actions** (group, merge, rearrange) → permanent changes, undoable with Cmd+Z
- **Confirmations** (destructive actions) → ephemeral, disappear after confirm/cancel
- **Progress indicators** → ephemeral, disappear when operation completes

## Chat Window (Secondary Surface)

Available for longer conversations but not the default interaction.

### How to Open

- Small chat icon in bottom toolbar or canvas corner
- Long/complex message in AI action bar can optionally expand into chat window

### What It Is

- Slide-out panel (right side of canvas)
- Standard chat thread with message history
- Same Claude API + tool set as canvas interaction
- AI can execute canvas actions from chat — same tools, same behavior
- Powered by Vercel AI SDK `useChat` hook for streaming and state management
- Custom UI components built with shadcn, styled to match Grain

### What It's For

- Multi-turn conversations that need back-and-forth
- Complex instructions requiring context
- Reviewing history of AI actions
- Canvas-wide questions not tied to a selection ("how many boards do I have?")

### What It's Not

- Not the primary interaction — canvas-first always
- Not always visible — user opens when needed
- Not a separate AI — same context, same tools, same model

## Image Generation

- User requests via canvas AI: "generate a hero image for this" / "create a dark texture"
- AI uses selection context (board DNA, colors, mood) to inform the prompt
- External API: **Flux via Replicate** (~$0.03/image). Provider can be swapped later.
- Progress card appears on canvas during generation
- Result placed on canvas as a regular image, uploaded to Supabase Storage for persistence
- Counts against AI credits (5 credits per generation)

## Web Image Search

- User requests via canvas AI: "find brutalist architecture photos" / "find more like this"
- AI constructs search query from message + selection context
- API: **Unsplash API** (free tier: 50 req/hour) or **Pexels API** (free: 200 req/hour)
- 4-6 results placed on canvas as ungrouped images in a loose cluster near selection
- User curates — keeps what they like, deletes the rest
- "Find similar" on a board uses DNA (mood tags, palette, style) to construct the query
- "Find similar" on an image uses AI description of that image as the query

## Phasing

Each phase is independently shippable.

### Phase 1: Foundation
- Custom selection toolbar (AI sparkle icon + download, replace tldraw defaults)
- AI action bar: hover expand, contextual suggestions, text input
- Thinking/progress indicators at selection point
- `POST /api/canvas-ai` route with tool-use architecture
- Core tools: `place_text`, `group_images`, `rename_board`, `delete_selection`, `analyze_selection`, `extract_dna`
- AI text responses placed on canvas with streaming
- Right-click "Ask AI..." option
- Undo support (free from tldraw)

### Phase 2: Canvas Power
- Additional tools: `merge_boards`, `split_board`, `rearrange`, `create_shape`, `move_to`
- Destructive action confirmation UI
- Chat window (slide-out panel with Vercel AI SDK + custom Grain UI)
- Streaming text responses on canvas

### Phase 3: Research & Generation
- `search_images` tool (Unsplash/Pexels integration)
- `generate_image` tool (Flux via Replicate)
- "Find similar" flow (board DNA → search query)
- Image gen progress cards on canvas
- Results uploaded to Supabase Storage

### Phase 4: Polish
- Shape cleanup tool (straighten, snap, SVG conversion)
- Animated AI cursor
- Smarter suggestions (learn from usage patterns)

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| AI Model | Claude Sonnet 4.6 | Already in use, tool-use support, good at intent parsing |
| Streaming | Vercel AI SDK | `useChat` for chat window, streaming helpers for canvas responses |
| Image Gen | Flux via Replicate | Good quality, simple API, swappable |
| Image Search | Unsplash API + Pexels API | Free tiers, good image quality |
| Chat UI | Custom shadcn components | Grain-native styling, lightweight |
| Canvas Integration | tldraw editor API | Already in use, full programmatic access |

## What Gets Replaced

- `SelectionActionBar` component — replaced by the new AI Action Bar. The "Group as Board" functionality moves into the AI's `group_images` tool and appears as a suggestion chip on multi-select.

## What Stays the Same

- Organize button — still handles bulk grouping of ungrouped images
- DNA panel — still the home for extraction, designer view, export
- Export flow — unchanged
- Image upload — unchanged
- Canvas interactions (pan, zoom, drag) — unchanged
- All existing tldraw functionality — unchanged except selection toolbar

## Cost Considerations

- Each canvas AI interaction: ~$0.01-0.03 (Claude API)
- Image generation: ~$0.03 per image (Replicate)
- Web search: free (Unsplash/Pexels free tiers)
- Conversation context in chat window grows with history — may need truncation strategy for long sessions
- All interactions count against the existing daily credit system from the PRD
