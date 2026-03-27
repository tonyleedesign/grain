# Grain Data Ownership Model

## Summary
Grain uses a split data model:

- SQL tables own semantic entities and workflow state
- `canvas_documents` owns the visual canvas world

This keeps the canvas flexible while preserving strong identity for boards, DNA, assets, and future ingest flows.

## Core Rule
Every important concept has one primary source of truth.

Shapes may store references like `boardId`, but they should not become the source of truth for the entity itself.

## Ownership

### `canvases`
Owns:
- canvas identity
- type (`community` or `private`)
- ownership
- stable `canvas_id`

Does not own:
- shapes
- board layout
- AI chat content

### `canvas_documents`
Owns:
- the persisted tldraw document
- all editor-native visual state:
  - shapes
  - positions
  - notes
  - links/bookmarks
  - AI cards
  - snapshot cards
  - board-linked artifact layout

Does not own:
- semantic board identity
- DNA history
- inbound queue state

### `boards`
Owns:
- semantic board identity
- `canvas_id`
- `frame_shape_id`
- canonical board name
- `latest_extraction_id`

Does not own:
- frame geometry
- attached AI chat content
- detached visual artifacts

### `board_extractions`
Owns:
- structured DNA output
- extraction history/versioning

Does not own:
- snapshot card placement
- board frame layout
- AI chats

### `images`
Owns:
- uploaded asset metadata
- storage identity/path

Does not own:
- on-canvas placement

### `captures` (future)
Owns:
- inbound Send to Grain items before placement
- status, error, retry state
- source metadata
- destination canvas id

Does not own:
- final visual placement after apply

### `capture_connections` (future)
Owns:
- external provider linkage, such as Telegram

## Relationship Rules

### Canvas relationship spine
- `canvas_id`

### Board relationship spine
- `boardId`

Use:
- custom shapes: `props.boardId`
- native tldraw shapes: `meta.boardId`
- SQL board row: `boards.id`
- SQL-to-frame link: `boards.frame_shape_id`

## Shape Rules

### Board frame
Stores:
- visual state in `canvas_documents`
- `meta.boardId`

### `ai-text`
Stores:
- messages
- title
- mode/status
- `canvasId`
- `boardId`

Reason:
- AI chat is a canvas artifact first

### `snapshot-card`
Stores:
- visual snapshot content
- `boardId`

Reason:
- visual artifact on canvas; DNA truth stays in `board_extractions`

### Native shapes
Use `meta.boardId` when board-linked.

Examples:
- bookmark
- embed
- dropped note/link/image inside a board

## Source-of-Truth Decisions

Primary source of truth:
- board identity -> `boards`
- DNA/history -> `board_extractions`
- visual canvas state -> `canvas_documents`
- AI chat content -> `ai-text` shape
- inbound capture queue -> `captures`

Cached references are allowed:
- `shape.props.boardId`
- `shape.meta.boardId`

But cached references do not replace entity ownership.

## Explicit Non-Goals
Do not add these yet:
- `ai_chats`
- `ai_messages`
- `canvas_shapes`
- `board_artifacts`

Reason:
- they would duplicate canvas-native state
- they add sync complexity without current product value

## Practical Guidance
Use a SQL table only if the data:
- must be queryable outside the canvas
- has workflow/history/state independent of the live canvas
- must exist while the canvas is closed

Keep data in `canvas_documents` if it is:
- primarily visual
- spatial
- manipulated directly on canvas
- tightly coupled to layout and editor behavior
