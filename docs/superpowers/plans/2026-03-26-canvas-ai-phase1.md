# Canvas AI Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI assistant accessible on any canvas selection — contextual suggestions, freeform text input, tool-use API route, and canvas-native text responses.

**Architecture:** Custom `AIActionBar` replaces the existing `SelectionActionBar`. User messages go to `POST /api/canvas-ai` which calls Claude with tool definitions. Claude returns tool calls (e.g. `place_text`, `group_images`), which are executed client-side against tldraw's `editor` API. A custom `ai-text` tldraw shape renders AI text responses on the canvas.

**Tech Stack:** TypeScript, Next.js API routes, `@anthropic-ai/sdk` (tool-use), tldraw (editor API + custom shapes), React, lucide-react icons, CSS variables for Grain theme tokens.

**Spec:** `docs/superpowers/specs/2026-03-26-canvas-ai-design.md` — Phase 1 section.

**Verification:** `npx tsc --noEmit` after each task + manual browser testing.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/canvas-ai.ts` | Create | Request/response types, tool parameter types, selection context shape |
| `src/lib/selection-context.ts` | Create | Build selection context from tldraw editor state |
| `src/app/api/canvas-ai/route.ts` | Create | POST endpoint — Claude API with tool-use |
| `src/app/api/canvas-ai/tools.ts` | Create | Tool definitions (JSON schema for Claude) and system prompt |
| `src/lib/canvas-ai-executor.ts` | Create | Client-side: execute tool calls against tldraw editor |
| `src/components/canvas/AITextShape.tsx` | Create | Custom tldraw shape for AI text on canvas |
| `src/components/canvas/AIActionBar.tsx` | Create | Selection UI — sparkle icon, hover expand, suggestions, text input |
| `src/components/canvas/AIThinkingIndicator.tsx` | Create | Pulsing sparkle + status text at selection point |
| `src/components/canvas/CanvasUI.tsx` | Modify | Replace `SelectionActionBar` with `AIActionBar`, add thinking indicator |
| `src/components/canvas/GrainCanvas.tsx` | Modify | Register `AITextShapeUtil` in `customShapeUtils` |

---

### Task 1: Types — Canvas AI request, response, and tool parameter types

**Files:**
- Create: `src/types/canvas-ai.ts`

- [ ] **Step 1: Create the types file**

```typescript
// Canvas AI types — request/response shapes, tool parameters, selection context.

// --- Selection context sent to the API ---

export interface CanvasAISelectionContext {
  selectionType: 'image' | 'board' | 'mixed' | 'shapes' | 'none'
  selectedImages?: {
    urls: string[]
    ungrouped: boolean
    boardName?: string
  }
  selectedBoards?: {
    names: string[]
    dnaSummaries?: string[]
  }
  canvasOverview: {
    totalBoards: number
    totalUngroupedImages: number
    boardNames: string[]
  }
}

// --- API request/response ---

export interface CanvasAIRequest {
  message: string
  context: CanvasAISelectionContext
  canvasId: string
  conversationId?: string
}

export interface CanvasAIToolCall {
  name: string
  input: Record<string, unknown>
}

export interface CanvasAIResponse {
  toolCalls: CanvasAIToolCall[]
  textResponse?: string
  error?: string
}

// --- Tool parameter types (one per tool) ---

export interface PlaceTextParams {
  text: string
  position: 'near_selection' | { x: number; y: number }
}

export interface GroupImagesParams {
  name: string
}

export interface RenameBoardParams {
  newName: string
}

export interface DeleteSelectionParams {
  confirm: boolean
}

// analyze_selection and extract_dna take no parameters

// --- Suggestion chip ---

export interface AISuggestion {
  label: string
  message: string
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to `canvas-ai.ts`

- [ ] **Step 3: Commit**

```bash
git add src/types/canvas-ai.ts
git commit -m "feat: add Canvas AI types for request, response, and tool parameters"
```

---

### Task 2: Selection context builder — read editor state into API-ready context

**Files:**
- Create: `src/lib/selection-context.ts`

This function reads the current tldraw editor state and produces the `CanvasAISelectionContext` object the API needs.

- [ ] **Step 1: Create the selection context builder**

```typescript
// Build Canvas AI selection context from tldraw editor state.
// Reads selected shapes, classifies them, and builds the context object.

import { Editor, TLImageShape, TLShape, TLShapeId } from 'tldraw'
import type { CanvasAISelectionContext } from '@/types/canvas-ai'

export function buildSelectionContext(editor: Editor): CanvasAISelectionContext {
  const selected = editor.getSelectedShapes()
  const allShapes = editor.getCurrentPageShapes()

  // Classify selected shapes
  const images: TLImageShape[] = []
  const boards: TLShape[] = []
  const otherShapes: TLShape[] = []

  for (const shape of selected) {
    if (shape.type === 'image') {
      images.push(shape as TLImageShape)
    } else if (shape.type === 'frame') {
      boards.push(shape)
    } else {
      otherShapes.push(shape)
    }
  }

  // Determine selection type
  let selectionType: CanvasAISelectionContext['selectionType']
  if (images.length > 0 && boards.length > 0) {
    selectionType = 'mixed'
  } else if (images.length > 0) {
    selectionType = 'image'
  } else if (boards.length > 0) {
    selectionType = 'board'
  } else if (otherShapes.length > 0) {
    selectionType = 'shapes'
  } else {
    selectionType = 'none'
  }

  // Build canvas overview
  const allBoards = allShapes.filter((s) => s.type === 'frame')
  const allImages = allShapes.filter((s) => s.type === 'image')
  const ungroupedImages = allImages.filter((s) => {
    const parent = editor.getShape(s.parentId as TLShapeId)
    return !parent || parent.type !== 'frame'
  })

  const canvasOverview = {
    totalBoards: allBoards.length,
    totalUngroupedImages: ungroupedImages.length,
    boardNames: allBoards.map((b) => (b.props as { name?: string }).name || 'Untitled'),
  }

  const context: CanvasAISelectionContext = { selectionType, canvasOverview }

  // Add image details if images are selected
  if (images.length > 0) {
    const urls: string[] = []
    let allUngrouped = true
    let boardName: string | undefined

    for (const img of images) {
      const asset = img.props.assetId ? editor.getAsset(img.props.assetId) : null
      const src = (asset?.props as { src?: string })?.src
      if (src) urls.push(src)

      const parent = editor.getShape(img.parentId as TLShapeId)
      if (parent?.type === 'frame') {
        allUngrouped = false
        boardName = (parent.props as { name?: string }).name
      }
    }

    context.selectedImages = {
      urls,
      ungrouped: allUngrouped,
      boardName,
    }
  }

  // Add board details if boards are selected
  if (boards.length > 0) {
    context.selectedBoards = {
      names: boards.map((b) => (b.props as { name?: string }).name || 'Untitled'),
    }
  }

  return context
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/selection-context.ts
git commit -m "feat: add selection context builder for Canvas AI"
```

---

### Task 3: API route — POST /api/canvas-ai with Claude tool-use

**Files:**
- Create: `src/app/api/canvas-ai/tools.ts`
- Create: `src/app/api/canvas-ai/route.ts`

- [ ] **Step 1: Create tool definitions and system prompt**

Create `src/app/api/canvas-ai/tools.ts`:

```typescript
// Canvas AI tool definitions — JSON schema for Claude function calling.
// Each tool maps to a canvas action executed client-side.

import Anthropic from '@anthropic-ai/sdk'

export const CANVAS_AI_SYSTEM = `You are a canvas AI assistant for Grain, a design inspiration tool. Users collect reference images on an infinite canvas, group them into boards, and extract design DNA.

You can take actions on the canvas via tools. You are a collaborator, not a lecturer.

Rules:
- When the user asks a question about their selection, use analyze_selection or place_text to respond ON THE CANVAS.
- When the user wants to organize images, use group_images.
- When the user wants to rename a board, use rename_board.
- For destructive actions (delete), always set confirm: false first — the client will prompt the user.
- Keep text responses concise — 1-3 sentences max. You're writing on a canvas, not a chat window.
- If you're unsure what the user wants, place a brief clarifying question as text on the canvas.`

export const CANVAS_AI_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'place_text',
    description: 'Write text on the canvas near the current selection. Use this for answers, descriptions, analysis results, or any text response.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'The text to place on the canvas.',
        },
        position: {
          description: 'Where to place the text. Use "near_selection" to place it near the current selection, or provide specific {x, y} coordinates.',
          oneOf: [
            { type: 'string', enum: ['near_selection'] },
            {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
              },
              required: ['x', 'y'],
            },
          ],
        },
      },
      required: ['text', 'position'],
    },
  },
  {
    name: 'group_images',
    description: 'Group the selected ungrouped images into a named board (frame). Only works when ungrouped images are selected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'The name for the new board.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'rename_board',
    description: 'Rename the selected board. Only works when exactly one board (frame) is selected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        newName: {
          type: 'string',
          description: 'The new name for the board.',
        },
      },
      required: ['newName'],
    },
  },
  {
    name: 'delete_selection',
    description: 'Delete the currently selected items. Always set confirm to false — the client will prompt the user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be false. The client handles confirmation.',
        },
      },
      required: ['confirm'],
    },
  },
  {
    name: 'analyze_selection',
    description: 'Describe what is currently selected — images, boards, or shapes. Returns a text description placed on the canvas.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'extract_dna',
    description: 'Trigger DNA extraction on the selected board. Only works when exactly one board is selected. Opens the DNA panel.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
]
```

- [ ] **Step 2: Create the API route**

Create `src/app/api/canvas-ai/route.ts`:

```typescript
// Canvas AI API route — Claude with tool-use for canvas actions.
// Receives selection context + user message, returns tool calls to execute client-side.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { CanvasAIRequest, CanvasAIResponse, CanvasAIToolCall } from '@/types/canvas-ai'
import { CANVAS_AI_SYSTEM, CANVAS_AI_TOOLS } from './tools'

export const maxDuration = 30

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

function buildUserMessage(req: CanvasAIRequest): string {
  const { message, context } = req
  const parts: string[] = []

  parts.push(`User message: "${message}"`)
  parts.push('')
  parts.push(`Selection: ${context.selectionType}`)

  if (context.selectedImages) {
    const { urls, ungrouped, boardName } = context.selectedImages
    parts.push(`Selected images: ${urls.length} image(s)${ungrouped ? ' (ungrouped)' : ` in board "${boardName}"`}`)
  }

  if (context.selectedBoards) {
    parts.push(`Selected boards: ${context.selectedBoards.names.join(', ')}`)
    if (context.selectedBoards.dnaSummaries?.length) {
      context.selectedBoards.dnaSummaries.forEach((summary, i) => {
        parts.push(`  ${context.selectedBoards!.names[i]}: ${summary}`)
      })
    }
  }

  parts.push('')
  parts.push(`Canvas overview: ${context.canvasOverview.totalBoards} boards, ${context.canvasOverview.totalUngroupedImages} ungrouped images`)
  if (context.canvasOverview.boardNames.length > 0) {
    parts.push(`Board names: ${context.canvasOverview.boardNames.join(', ')}`)
  }

  return parts.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CanvasAIRequest

    if (!body.message || !body.context || !body.canvasId) {
      return NextResponse.json(
        { error: 'message, context, and canvasId are required' },
        { status: 400 }
      )
    }

    const userMessage = buildUserMessage(body)

    // Include image URLs as vision content if images are selected
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
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: CANVAS_AI_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: CANVAS_AI_TOOLS,
      messages: [{ role: 'user', content }],
    })

    console.log(`[canvas-ai] tokens — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}`)

    // Extract tool calls and text from response
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

    // If Claude responded with text but no place_text tool call, wrap it as one
    if (textResponse && !toolCalls.some((tc) => tc.name === 'place_text')) {
      toolCalls.push({
        name: 'place_text',
        input: { text: textResponse, position: 'near_selection' },
      })
      textResponse = undefined
    }

    const result: CanvasAIResponse = { toolCalls, textResponse }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Canvas AI error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Canvas AI failed' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/canvas-ai/tools.ts src/app/api/canvas-ai/route.ts
git commit -m "feat: add Canvas AI API route with Claude tool-use"
```

---

### Task 4: AI text shape — custom tldraw shape for AI responses on canvas

**Files:**
- Create: `src/components/canvas/AITextShape.tsx`
- Modify: `src/components/canvas/GrainCanvas.tsx`

- [ ] **Step 1: Create the AI text shape**

Create `src/components/canvas/AITextShape.tsx`. Follow the exact pattern from `SnapshotCardShape.tsx`:

```typescript
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

// Module augmentation to register custom shape type with tldraw
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'ai-text': AITextProps
  }
}

interface AITextProps {
  w: number
  h: number
  text: string
}

export type AITextShape = TLBaseShape<'ai-text', AITextProps>

export const aiTextProps: RecordProps<AITextShape> = {
  w: T.number,
  h: T.number,
  text: T.string,
}

const PADDING = 12
const BORDER_WIDTH = 3
const FONT_SIZE = 13
const LINE_HEIGHT = 1.5
const MAX_WIDTH = 320

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
      w: MAX_WIDTH,
      h: 40,
      text: '',
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
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
            fontFamily: 'var(--font-family)',
            color: 'var(--color-muted)',
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
```

- [ ] **Step 2: Register the shape in GrainCanvas**

In `src/components/canvas/GrainCanvas.tsx`, add the import and register the shape:

Add import at line 13 (after SnapshotCardShape import):
```typescript
import { AITextShapeUtil } from './AITextShape'
```

Change line 22:
```typescript
// Old:
const customShapeUtils = useMemo(() => [SnapshotCardShapeUtil], [])
// New:
const customShapeUtils = useMemo(() => [SnapshotCardShapeUtil, AITextShapeUtil], [])
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/AITextShape.tsx src/components/canvas/GrainCanvas.tsx
git commit -m "feat: add AI text custom shape for canvas responses"
```

---

### Task 5: Client-side tool executor — execute Claude tool calls against tldraw editor

**Files:**
- Create: `src/lib/canvas-ai-executor.ts`

This function takes tool calls from the API response and executes them against the tldraw editor. It reuses the same grouping logic from `SelectionActionBar.tsx` for `group_images`.

- [ ] **Step 1: Create the executor**

```typescript
// Canvas AI tool executor — maps Claude tool calls to tldraw editor operations.
// Each tool function takes the editor + params, mutates the canvas, returns a status message.

import { Editor, TLImageShape, TLShapeId, createShapeId } from 'tldraw'
import type { CanvasAIToolCall } from '@/types/canvas-ai'

const BOARD_PADDING = 24
const IMAGE_GAP = 12
const ROW_HEIGHT = 250
const MAX_ROW_WIDTH = 900
const AI_TEXT_OFFSET_Y = 24

interface ExecutionResult {
  success: boolean
  message: string
  /** If true, the AI Action Bar should trigger DNA extraction on the selected board */
  triggerExtractDna?: boolean
  /** If true, show a delete confirmation prompt */
  needsDeleteConfirmation?: boolean
}

export async function executeToolCalls(
  editor: Editor,
  toolCalls: CanvasAIToolCall[],
  canvasId: string
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = []

  for (const call of toolCalls) {
    const result = await executeOne(editor, call, canvasId)
    results.push(result)
  }

  return results
}

async function executeOne(
  editor: Editor,
  call: CanvasAIToolCall,
  canvasId: string
): Promise<ExecutionResult> {
  switch (call.name) {
    case 'place_text':
      return executePlaceText(editor, call.input as { text: string; position: string | { x: number; y: number } })

    case 'group_images':
      return executeGroupImages(editor, call.input as { name: string }, canvasId)

    case 'rename_board':
      return executeRenameBoard(editor, call.input as { newName: string })

    case 'delete_selection':
      return { success: true, message: 'Confirm deletion?', needsDeleteConfirmation: true }

    case 'analyze_selection':
      // analyze_selection is handled by Claude's response — it returns text via place_text
      return { success: true, message: 'Analysis complete' }

    case 'extract_dna':
      return { success: true, message: 'Opening DNA extraction...', triggerExtractDna: true }

    default:
      return { success: false, message: `Unknown tool: ${call.name}` }
  }
}

function executePlaceText(
  editor: Editor,
  params: { text: string; position: string | { x: number; y: number } }
): ExecutionResult {
  let x: number
  let y: number

  if (params.position === 'near_selection') {
    const bounds = editor.getSelectionPageBounds()
    if (bounds) {
      x = bounds.maxX + AI_TEXT_OFFSET_Y
      y = bounds.minY
    } else {
      // Fallback: center of viewport
      const viewport = editor.getViewportPageBounds()
      x = viewport.midX
      y = viewport.midY
    }
  } else {
    const pos = params.position as { x: number; y: number }
    x = pos.x
    y = pos.y
  }

  // Estimate height from text length (rough: 20px per line, ~50 chars per line at 320w)
  const estimatedLines = Math.max(1, Math.ceil(params.text.length / 50))
  const estimatedHeight = estimatedLines * 20 + 24

  const shapeId = createShapeId()
  editor.createShape({
    id: shapeId,
    type: 'ai-text',
    x,
    y,
    props: {
      w: 320,
      h: estimatedHeight,
      text: params.text,
    },
  })

  return { success: true, message: 'Text placed on canvas' }
}

function executeGroupImages(
  editor: Editor,
  params: { name: string },
  canvasId: string
): ExecutionResult {
  const selected = editor.getSelectedShapes()
  const images = selected.filter((s): s is TLImageShape => {
    if (s.type !== 'image') return false
    const parent = editor.getShape(s.parentId as TLShapeId)
    return !parent || parent.type !== 'frame'
  })

  if (images.length === 0) {
    return { success: false, message: 'No ungrouped images selected' }
  }

  // Scale images to consistent row height
  const scaled = images.map((img) => {
    const aspect = img.props.w / (img.props.h || 1)
    const w = Math.round(ROW_HEIGHT * aspect)
    return { img, w, h: ROW_HEIGHT }
  })

  // Pack into rows
  const rows: typeof scaled[] = []
  let currentRow: typeof scaled = []
  let currentRowWidth = 0

  for (const item of scaled) {
    const itemTotalWidth = currentRow.length > 0 ? IMAGE_GAP + item.w : item.w
    if (currentRowWidth + itemTotalWidth > MAX_ROW_WIDTH && currentRow.length > 0) {
      rows.push(currentRow)
      currentRow = [item]
      currentRowWidth = item.w
    } else {
      currentRow.push(item)
      currentRowWidth += itemTotalWidth
    }
  }
  if (currentRow.length > 0) rows.push(currentRow)

  // Calculate frame size
  const rowWidths = rows.map((row) =>
    row.reduce((sum, item) => sum + item.w, 0) + (row.length - 1) * IMAGE_GAP
  )
  const maxRowWidth = Math.max(...rowWidths)
  const totalHeight = rows.length * ROW_HEIGHT + (rows.length - 1) * IMAGE_GAP
  const frameW = maxRowWidth + BOARD_PADDING * 2
  const frameH = totalHeight + BOARD_PADDING * 2 + 40

  // Position at center of selected images
  const avgX = images.reduce((sum, img) => sum + img.x, 0) / images.length
  const avgY = images.reduce((sum, img) => sum + img.y, 0) / images.length

  const frameId = createShapeId()

  editor.run(() => {
    editor.createShape({
      id: frameId,
      type: 'frame',
      x: avgX - frameW / 2,
      y: avgY - frameH / 2,
      props: { w: frameW, h: frameH, name: params.name },
    })

    let rowY = BOARD_PADDING + 40
    for (const row of rows) {
      let x = BOARD_PADDING
      for (const item of row) {
        editor.updateShape({
          id: item.img.id as TLShapeId,
          type: 'image',
          parentId: frameId,
          x,
          y: rowY,
          props: { ...item.img.props, w: item.w, h: item.h },
        })
        x += item.w + IMAGE_GAP
      }
      rowY += ROW_HEIGHT + IMAGE_GAP
    }
  })

  // Save board to Supabase (fire-and-forget)
  fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: params.name, canvasId }),
  }).catch((err) => console.error('Board save error:', err))

  editor.select(frameId)

  return { success: true, message: `Grouped ${images.length} images into "${params.name}"` }
}

function executeRenameBoard(
  editor: Editor,
  params: { newName: string }
): ExecutionResult {
  const selected = editor.getSelectedShapes()
  const frame = selected.find((s) => s.type === 'frame')

  if (!frame) {
    return { success: false, message: 'No board selected' }
  }

  editor.updateShape({
    id: frame.id as TLShapeId,
    type: 'frame',
    props: { ...(frame.props as Record<string, unknown>), name: params.newName },
  })

  return { success: true, message: `Renamed to "${params.newName}"` }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/canvas-ai-executor.ts
git commit -m "feat: add client-side tool executor for Canvas AI"
```

---

### Task 6: AI Thinking Indicator — pulsing sparkle + status text at selection point

**Files:**
- Create: `src/components/canvas/AIThinkingIndicator.tsx`

- [ ] **Step 1: Create the thinking indicator component**

```typescript
'use client'

// AI Thinking Indicator — pulsing sparkle icon + status text.
// Positioned at the selection point, replacing the AI action bar during processing.

import { useEditor, useValue } from 'tldraw'
import { Sparkles } from 'lucide-react'

interface AIThinkingIndicatorProps {
  status: string // e.g. "Thinking...", "Grouping images...", "Writing..."
}

export function AIThinkingIndicator({ status }: AIThinkingIndicatorProps) {
  const editor = useEditor()

  const position = useValue(
    'thinkingPosition',
    () => {
      const bounds = editor.getSelectionPageBounds()
      if (!bounds) return null
      return editor.pageToViewport({ x: bounds.midX, y: bounds.minY })
    },
    [editor]
  )

  if (!position) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-surface)',
        boxShadow: 'var(--shadow-toolbar)',
        fontFamily: 'var(--font-family)',
        fontSize: 12,
        color: 'var(--color-muted)',
        pointerEvents: 'none',
      }}
    >
      <Sparkles
        size={13}
        style={{
          color: 'var(--color-accent)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      {status}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/AIThinkingIndicator.tsx
git commit -m "feat: add AI thinking indicator component"
```

---

### Task 7: AI Action Bar — selection UI with sparkle icon, suggestions, and text input

**Files:**
- Create: `src/components/canvas/AIActionBar.tsx`

This is the main UI component. It replaces `SelectionActionBar` and shows on ANY selection (not just 2+ ungrouped images). Hover on sparkle icon expands to show suggestions + text input.

- [ ] **Step 1: Create the AI Action Bar**

```typescript
'use client'

// AI Action Bar — replaces the default selection toolbar.
// Shows sparkle icon on any selection. Hover expands to suggestions + text input.
// Sends messages to /api/canvas-ai and executes tool calls against the editor.

import { useState, useCallback, useRef, useEffect } from 'react'
import { useEditor, useValue, TLShapeId } from 'tldraw'
import { Sparkles, Download, Send } from 'lucide-react'
import { buildSelectionContext } from '@/lib/selection-context'
import { executeToolCalls } from '@/lib/canvas-ai-executor'
import type { CanvasAIResponse, AISuggestion } from '@/types/canvas-ai'
import { AIThinkingIndicator } from './AIThinkingIndicator'

interface AIActionBarProps {
  canvasId: string
  onExtractDna?: () => void
}

// Contextual suggestions based on selection type
function getSuggestions(
  selectionType: string,
  imageCount: number,
  isUngrouped: boolean,
  boardCount: number
): AISuggestion[] {
  if (selectionType === 'image' && imageCount === 1 && isUngrouped) {
    return [
      { label: 'What is this?', message: 'What is this image?' },
      { label: 'Describe', message: 'Describe this image in detail' },
    ]
  }
  if (selectionType === 'image' && imageCount === 1 && !isUngrouped) {
    return [
      { label: 'Describe', message: 'Describe this image' },
    ]
  }
  if (selectionType === 'image' && imageCount >= 2) {
    return [
      { label: 'Group as board', message: 'Group these images into a board with a descriptive name' },
      { label: 'What do these have in common?', message: 'What do these images have in common?' },
    ]
  }
  if (selectionType === 'board' && boardCount === 1) {
    return [
      { label: 'Extract DNA', message: 'Extract DNA from this board' },
      { label: 'Rename', message: 'Suggest a better name for this board based on its images' },
    ]
  }
  if (selectionType === 'board' && boardCount >= 2) {
    return [
      { label: 'Compare', message: 'Compare these boards — what makes each unique?' },
      { label: "What's different?", message: "What's different between these boards?" },
    ]
  }
  return []
}

export function AIActionBar({ canvasId, onExtractDna }: AIActionBarProps) {
  const editor = useEditor()
  const [expanded, setExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [thinkingStatus, setThinkingStatus] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track if anything is selected
  const hasSelection = useValue(
    'hasSelection',
    () => editor.getSelectedShapes().length > 0,
    [editor]
  )

  // Get selection info for suggestions
  const selectionInfo = useValue(
    'selectionInfo',
    () => {
      const selected = editor.getSelectedShapes()
      const images = selected.filter((s) => s.type === 'image')
      const boards = selected.filter((s) => s.type === 'frame')
      const ungrouped = images.filter((s) => {
        const parent = editor.getShape(s.parentId as TLShapeId)
        return !parent || parent.type !== 'frame'
      })

      let type = 'none'
      if (images.length > 0 && boards.length > 0) type = 'mixed'
      else if (images.length > 0) type = 'image'
      else if (boards.length > 0) type = 'board'
      else if (selected.length > 0) type = 'shapes'

      return {
        type,
        imageCount: images.length,
        isUngrouped: ungrouped.length === images.length,
        boardCount: boards.length,
      }
    },
    [editor]
  )

  // Get bar position (above selection)
  const barPosition = useValue(
    'aiBarPosition',
    () => {
      const bounds = editor.getSelectionPageBounds()
      if (!bounds) return null
      return editor.pageToViewport({ x: bounds.midX, y: bounds.minY })
    },
    [editor]
  )

  // Close on click outside
  useEffect(() => {
    if (!expanded) return
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setInputValue('')
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false)
        setInputValue('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [expanded])

  // Focus input when expanded
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [expanded])

  // Close when selection changes
  useEffect(() => {
    setExpanded(false)
    setInputValue('')
    setShowDeleteConfirm(false)
  }, [selectionInfo.type, selectionInfo.imageCount, selectionInfo.boardCount])

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isProcessing) return

    setIsProcessing(true)
    setThinkingStatus('Thinking...')
    setExpanded(false)
    setInputValue('')

    try {
      const context = buildSelectionContext(editor)

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

      // Execute tool calls
      if (data.toolCalls.length > 0) {
        setThinkingStatus('Executing...')
        const results = await executeToolCalls(editor, data.toolCalls, canvasId)

        // Handle special results
        for (const result of results) {
          if (result.triggerExtractDna && onExtractDna) {
            onExtractDna()
          }
          if (result.needsDeleteConfirmation) {
            setShowDeleteConfirm(true)
          }
        }
      }
    } catch (error) {
      console.error('Canvas AI error:', error)
      // Place error text on canvas
      const bounds = editor.getSelectionPageBounds()
      if (bounds) {
        const { createShapeId } = await import('tldraw')
        editor.createShape({
          id: createShapeId(),
          type: 'ai-text',
          x: bounds.maxX + 24,
          y: bounds.minY,
          props: {
            w: 280,
            h: 40,
            text: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
          },
        })
      }
    } finally {
      setIsProcessing(false)
      setThinkingStatus('')
    }
  }, [editor, canvasId, isProcessing, onExtractDna])

  const handleDeleteConfirm = useCallback(() => {
    editor.deleteShapes(editor.getSelectedShapeIds())
    setShowDeleteConfirm(false)
  }, [editor])

  if (!hasSelection || !barPosition) return null

  // Show thinking indicator while processing
  if (isProcessing) {
    return <AIThinkingIndicator status={thinkingStatus} />
  }

  // Show delete confirmation
  if (showDeleteConfirm) {
    return (
      <div
        style={{
          position: 'fixed',
          left: barPosition.x,
          top: barPosition.y - 12,
          transform: 'translate(-50%, -100%)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-toolbar)',
          fontFamily: 'var(--font-family)',
          fontSize: 12,
          pointerEvents: 'auto',
        }}
      >
        <span style={{ color: 'var(--color-text)' }}>Delete selection?</span>
        <button
          onClick={handleDeleteConfirm}
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#b44040',
            color: '#fff',
            border: 'none',
            fontSize: 11,
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
        <button
          onClick={() => setShowDeleteConfirm(false)}
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-muted)',
            border: '1px solid var(--color-border)',
            fontSize: 11,
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    )
  }

  const suggestions = getSuggestions(
    selectionInfo.type,
    selectionInfo.imageCount,
    selectionInfo.isUngrouped,
    selectionInfo.boardCount
  )

  return (
    <div
      ref={barRef}
      style={{
        position: 'fixed',
        left: barPosition.x,
        top: barPosition.y - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'auto',
      }}
    >
      {expanded ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '8px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-toolbar)',
            fontFamily: 'var(--font-family)',
            minWidth: 240,
          }}
        >
          {/* Suggestion chips */}
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s.message)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    fontSize: 11,
                    fontFamily: 'var(--font-family)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'
                  }}
                >
                  <Sparkles size={10} style={{ color: 'var(--color-accent)' }} />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Text input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  sendMessage(inputValue)
                }
                // Stop propagation to prevent tldraw from handling keyboard events
                e.stopPropagation()
              }}
              placeholder="Ask AI..."
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                fontSize: 12,
                fontFamily: 'var(--font-family)',
                outline: 'none',
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--color-accent)'
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--color-border)'
              }}
            />
            <button
              onClick={() => inputValue.trim() && sendMessage(inputValue)}
              disabled={!inputValue.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-md)',
                backgroundColor: inputValue.trim() ? 'var(--color-accent)' : 'var(--color-bg)',
                color: inputValue.trim() ? '#fff' : 'var(--color-muted)',
                border: 'none',
                cursor: inputValue.trim() ? 'pointer' : 'default',
              }}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-toolbar)',
          }}
        >
          {/* Download button (kept from original toolbar) */}
          <button
            onClick={() => {
              // Trigger tldraw's export for selected shapes
              const ids = editor.getSelectedShapeIds()
              if (ids.length > 0) {
                editor.getSvg(ids).then((svg) => {
                  if (!svg) return
                  const svgStr = new XMLSerializer().serializeToString(svg)
                  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'selection.svg'
                  a.click()
                  URL.revokeObjectURL(url)
                })
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              color: 'var(--color-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Download selection"
          >
            <Download size={14} />
          </button>

          {/* AI sparkle icon — hover to expand */}
          <button
            onMouseEnter={() => setExpanded(true)}
            onClick={() => setExpanded(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              color: 'var(--color-accent)',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Ask AI"
          >
            <Sparkles size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/AIActionBar.tsx
git commit -m "feat: add AI Action Bar with suggestions, text input, and tool execution"
```

---

### Task 8: Integration — wire AIActionBar into CanvasUI, replace SelectionActionBar

**Files:**
- Modify: `src/components/canvas/CanvasUI.tsx`

- [ ] **Step 1: Replace SelectionActionBar with AIActionBar in CanvasUI**

Replace the full contents of `src/components/canvas/CanvasUI.tsx`:

```typescript
'use client'

// Canvas UI layer — lives inside <Tldraw> context.
// Manages DNA panel visibility based on frame selection.
// Reference: grain-prd.md Section 11.3

import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, useValue } from 'tldraw'
import { OrganizeButton } from './OrganizeButton'
import { AIActionBar } from './AIActionBar'
import { DNAPanelV2 } from '../dna/DNAPanelV2'

interface CanvasUIProps {
  canvasId: string
}

export function CanvasUI({ canvasId }: CanvasUIProps) {
  const editor = useEditor()
  const [activeBoardName, setActiveBoardName] = useState<string | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const lastBoardName = useRef<string | null>(null)

  // Watch for selection changes reactively
  const selectedShapes = useValue(
    'selectedShapes',
    () => editor.getSelectedShapes(),
    [editor]
  )

  useEffect(() => {
    // If exactly one frame is selected, open its DNA panel
    if (selectedShapes.length === 1 && selectedShapes[0].type === 'frame') {
      const frame = selectedShapes[0]
      const name = (frame.props as { name?: string }).name
      if (name) {
        setActiveBoardName(name)
        lastBoardName.current = name
        setPanelVisible(true)
        return
      }
    }
    // Nothing selected — hide the panel but keep it mounted
    if (selectedShapes.length === 0) {
      setPanelVisible(false)
    }
  }, [selectedShapes])

  // Callback for AI to trigger DNA extraction
  const handleExtractDna = useCallback(() => {
    // If a board is selected, open the DNA panel
    const selected = editor.getSelectedShapes()
    const frame = selected.find((s) => s.type === 'frame')
    if (frame) {
      const name = (frame.props as { name?: string }).name
      if (name) {
        setActiveBoardName(name)
        lastBoardName.current = name
        setPanelVisible(true)
      }
    }
  }, [editor])

  const boardToRender = activeBoardName || lastBoardName.current

  return (
    <>
      <OrganizeButton canvasId={canvasId} />
      <AIActionBar canvasId={canvasId} onExtractDna={handleExtractDna} />
      {boardToRender && (
        <div style={{ display: panelVisible ? 'contents' : 'none' }}>
          <DNAPanelV2
            boardName={boardToRender}
            canvasId={canvasId}
            onClose={() => setPanelVisible(false)}
          />
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test in browser**

1. Run `npm run dev`
2. Select a single image → AI action bar appears with sparkle icon + download
3. Hover on sparkle → expands to show suggestions + "Ask AI..." input
4. Select 2+ ungrouped images → "Group as board" suggestion appears
5. Select a board → "Extract DNA" and "Rename" suggestions appear
6. Type a message and press Enter → thinking indicator shows, then AI text appears on canvas
7. Cmd+Z → AI text is undone

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/CanvasUI.tsx
git commit -m "feat: replace SelectionActionBar with AIActionBar in CanvasUI"
```

---

### Task 9: Right-click context menu — "Ask AI..." option

**Files:**
- Modify: `src/components/canvas/AIActionBar.tsx`
- Modify: `src/components/canvas/CanvasUI.tsx`

- [ ] **Step 1: Add right-click handler to CanvasUI**

In `src/components/canvas/CanvasUI.tsx`, add a contextmenu listener that opens the AI action bar in expanded mode.

Add state for right-click trigger:

```typescript
const [rightClickAI, setRightClickAI] = useState(false)
```

Add the effect after the existing `selectedShapes` effect:

```typescript
  // Right-click context menu: "Ask AI..." option
  useEffect(() => {
    const container = document.querySelector('.grain-canvas-wrapper')
    if (!container) return

    const handleContextMenu = (e: Event) => {
      const mouseEvent = e as MouseEvent
      // Only intercept if something is selected
      if (editor.getSelectedShapes().length === 0) return

      mouseEvent.preventDefault()

      // Show a minimal context menu at cursor position
      const existing = document.getElementById('grain-context-menu')
      if (existing) existing.remove()

      const menu = document.createElement('div')
      menu.id = 'grain-context-menu'
      menu.style.cssText = `
        position: fixed;
        left: ${mouseEvent.clientX}px;
        top: ${mouseEvent.clientY}px;
        z-index: 2000;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-panel);
        padding: 4px;
        font-family: var(--font-family);
        font-size: 12px;
      `

      const askAI = document.createElement('button')
      askAI.innerHTML = '✨ Ask AI...'
      askAI.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 6px 12px;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text);
        font-family: var(--font-family);
        font-size: 12px;
        cursor: pointer;
        text-align: left;
      `
      askAI.onmouseenter = () => { askAI.style.background = 'var(--color-bg)' }
      askAI.onmouseleave = () => { askAI.style.background = 'transparent' }
      askAI.onclick = () => {
        menu.remove()
        setRightClickAI(true)
      }

      menu.appendChild(askAI)
      document.body.appendChild(menu)

      // Remove menu on next click
      const cleanup = () => {
        menu.remove()
        document.removeEventListener('mousedown', cleanup)
      }
      setTimeout(() => document.addEventListener('mousedown', cleanup), 0)
    }

    container.addEventListener('contextmenu', handleContextMenu)
    return () => container.removeEventListener('contextmenu', handleContextMenu)
  }, [editor])
```

Pass `rightClickAI` to `AIActionBar` and add a reset callback:

```typescript
<AIActionBar
  canvasId={canvasId}
  onExtractDna={handleExtractDna}
  forceExpanded={rightClickAI}
  onForceExpandedConsumed={() => setRightClickAI(false)}
/>
```

- [ ] **Step 2: Update AIActionBar to accept forceExpanded prop**

In `src/components/canvas/AIActionBar.tsx`, update the props interface:

```typescript
interface AIActionBarProps {
  canvasId: string
  onExtractDna?: () => void
  forceExpanded?: boolean
  onForceExpandedConsumed?: () => void
}
```

Update the destructured props:

```typescript
export function AIActionBar({ canvasId, onExtractDna, forceExpanded, onForceExpandedConsumed }: AIActionBarProps) {
```

Add an effect to handle `forceExpanded`:

```typescript
  // Handle right-click "Ask AI..." trigger
  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true)
      onForceExpandedConsumed?.()
    }
  }, [forceExpanded, onForceExpandedConsumed])
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Test in browser**

1. Select any element on the canvas
2. Right-click → context menu shows "Ask AI..." option
3. Click "Ask AI..." → AI action bar expands with input focused
4. Click elsewhere → context menu and expanded bar dismiss

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/AIActionBar.tsx src/components/canvas/CanvasUI.tsx
git commit -m "feat: add right-click 'Ask AI...' context menu option"
```

---

### Task 10: Final verification and cleanup

**Files:**
- Verify all files compile and work together

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify the old SelectionActionBar is no longer imported**

Check that `CanvasUI.tsx` no longer imports `SelectionActionBar`. The file `src/components/canvas/SelectionActionBar.tsx` still exists but is now unused — it can be kept for reference or deleted.

- [ ] **Step 3: Browser test — full flow**

1. `npm run dev`
2. Upload some images to canvas
3. Select a single image → action bar shows sparkle + download icons
4. Hover sparkle → suggestions: "What is this?" · "Describe"
5. Click "What is this?" → thinking indicator → AI text appears on canvas next to image
6. Select 2+ ungrouped images → suggestions: "Group as board" · "What do these have in common?"
7. Click "Group as board" → images grouped into a named frame
8. Select the new board → suggestions: "Extract DNA" · "Rename"
9. Type custom message in "Ask AI..." input → Claude responds with appropriate tool call
10. Right-click on selection → "Ask AI..." → expands action bar
11. Cmd+Z → undo any AI action
12. Verify DNA panel still opens when a single board is selected

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from Canvas AI Phase 1 integration testing"
```
