import {
  AssetRecordType,
  Editor,
  TLFrameShape,
  TLParentId,
  TLPageId,
  TLShapeId,
  createShapeId,
} from 'tldraw'
import { getBoardIdFromMeta } from './board-identity'
import type { PendingCapture } from '@/types/captures'
import type {
  HoldingCellArtifact,
  HoldingCellBoardProposal,
  PlacementPlan,
  PlacementPlanBoardChild,
  PlacementPlanBoardItem,
  PlacementPlanCaptureItem,
} from '@/types/holding-cell'

const ITEM_GAP = 24
const BOARD_PADDING = 24
const BOARD_HEADER_HEIGHT = 40
const MAX_ROW_WIDTH = 900
const TARGET_IMAGE_HEIGHT = 250
const DEFAULT_IMAGE_WIDTH = 280
const DEFAULT_BOOKMARK_WIDTH = 320
const DEFAULT_BOOKMARK_HEIGHT = 220
const MAX_LINK_WIDTH = 320
const MAX_LINK_HEIGHT = 220

type PlacementSizingMode = 'normalize' | 'preserve'

function loadImageNaturalDimensions(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const timeout = setTimeout(() => resolve(null), 5000)
    img.onload = () => {
      clearTimeout(timeout)
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.onerror = () => {
      clearTimeout(timeout)
      resolve(null)
    }
    img.src = src
  })
}

// Loads natural image dimensions for all image-kind artifacts in parallel.
// Browsers typically serve these from cache (images are already loaded in the holding cell),
// so this is near-instant. Fixes object-fit:cover cropping caused by wrong stored dimensions.
export async function enrichArtifactsWithNaturalDimensions(
  artifacts: HoldingCellArtifact[]
): Promise<HoldingCellArtifact[]> {
  return Promise.all(
    artifacts.map(async (artifact) => {
      if (artifact.kind !== 'image') return artifact
      const src = artifact.previewUrl || artifact.url
      if (!src) return artifact
      const dims = await loadImageNaturalDimensions(src)
      if (!dims || dims.w === 0 || dims.h === 0) return artifact
      return { ...artifact, width: dims.w, height: dims.h }
    })
  )
}

export function getTargetPageId(editor: Editor, capture: PendingCapture): TLPageId {
  const pageId =
    typeof capture.metadata?.targetPageId === 'string' ? capture.metadata.targetPageId : null

  if (pageId && editor.getPage(pageId as TLPageId)) {
    return pageId as TLPageId
  }

  return editor.getCurrentPageId()
}

export function pendingCaptureToArtifact(capture: PendingCapture): HoldingCellArtifact {
  const metadata = capture.metadata || {}
  const width =
    typeof metadata.width === 'number' && metadata.width > 0 ? metadata.width : DEFAULT_IMAGE_WIDTH
  const height =
    typeof metadata.height === 'number' && metadata.height > 0
      ? metadata.height
      : Math.round(width * 0.75)

  const normalizedKind =
    capture.content_kind === 'image'
      ? 'image'
      : capture.content_kind === 'embed_candidate'
        ? 'embed'
        : 'bookmark'

  return {
    id: capture.id,
    kind: normalizedKind,
    url: capture.canonical_url || capture.original_url || '',
    previewUrl: capture.preview_image_url || undefined,
    title: capture.title || undefined,
    description:
      (typeof metadata.description === 'string' && metadata.description) || capture.site_name || undefined,
    position_x: 0,
    position_y: 0,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    sourceChannel: capture.source_channel,
    siteName: capture.site_name || undefined,
    targetPageId:
      typeof metadata.targetPageId === 'string' ? metadata.targetPageId : null,
    targetPageName:
      typeof metadata.targetPageName === 'string' ? metadata.targetPageName : null,
  }
}

function getArtifactPlacementDimensions(artifact: HoldingCellArtifact, sizingMode: PlacementSizingMode) {
  if (sizingMode === 'preserve') {
    return {
      width: Math.max(1, Math.round(artifact.width)),
      height: Math.max(1, Math.round(artifact.height)),
    }
  }

  if (artifact.kind === 'image') {
    const aspect = artifact.width / Math.max(artifact.height, 1)
    const width = Math.max(120, Math.round(TARGET_IMAGE_HEIGHT * aspect))
    return {
      width,
      height: TARGET_IMAGE_HEIGHT,
    }
  }

  const scale = Math.min(MAX_LINK_WIDTH / artifact.width, MAX_LINK_HEIGHT / artifact.height, 1)
  return {
    width: Math.max(180, Math.round(artifact.width * scale)),
    height: Math.max(120, Math.round(artifact.height * scale)),
  }
}

function buildBoardLayout(board: HoldingCellBoardProposal, sizingMode: PlacementSizingMode) {
  const laidOut = board.artifacts.map((artifact) => ({
    artifact,
    ...getArtifactPlacementDimensions(artifact, sizingMode),
  }))

  const rows: typeof laidOut[] = []
  let currentRow: typeof laidOut = []
  let currentRowWidth = 0

  for (const item of laidOut) {
    const nextWidth = currentRow.length > 0 ? currentRowWidth + ITEM_GAP + item.width : item.width
    if (nextWidth > MAX_ROW_WIDTH && currentRow.length > 0) {
      rows.push(currentRow)
      currentRow = [item]
      currentRowWidth = item.width
    } else {
      currentRow.push(item)
      currentRowWidth = nextWidth
    }
  }

  if (currentRow.length > 0) rows.push(currentRow)

  const rowWidths = rows.map((row) => row.reduce((sum, item) => sum + item.width, 0) + (row.length - 1) * ITEM_GAP)
  const rowHeights = rows.map((row) => Math.max(...row.map((item) => item.height)))
  const width = Math.max(...rowWidths, 240) + BOARD_PADDING * 2
  const height =
    rowHeights.reduce((sum, value) => sum + value, 0) +
    (rows.length - 1) * ITEM_GAP +
    BOARD_PADDING * 2 +
    BOARD_HEADER_HEIGHT

  const children: PlacementPlanBoardChild[] = []
  let rowY = BOARD_PADDING + BOARD_HEADER_HEIGHT

  rows.forEach((row, rowIndex) => {
    let x = BOARD_PADDING
    row.forEach((item) => {
      children.push({
        artifact: item.artifact,
        x,
        y: rowY,
        width: item.width,
        height: item.height,
      })
      x += item.width + ITEM_GAP
    })
    rowY += rowHeights[rowIndex] + ITEM_GAP
  })

  return { width, height, children }
}

function buildLooseCaptureItems(artifacts: HoldingCellArtifact[], sizingMode: PlacementSizingMode) {
  return artifacts.map((artifact) => ({
    artifact,
    ...getArtifactPlacementDimensions(artifact, sizingMode),
  }))
}

export function buildPlacementPlan({
  artifacts,
  boards,
  sizingMode = 'normalize',
}: {
  artifacts: HoldingCellArtifact[]
  boards: HoldingCellBoardProposal[]
  sizingMode?: PlacementSizingMode
}): PlacementPlan {
  const normalizedItems: Array<{
    id: string
    kind: 'capture' | 'board'
    width: number
    height: number
    artifact?: HoldingCellArtifact
    board?: HoldingCellBoardProposal
    children?: PlacementPlanBoardChild[]
  }> = [
    ...boards.map((board) => {
      const layout = buildBoardLayout(board, sizingMode)
      return {
        id: `board:${board.id}`,
        kind: 'board' as const,
        width: layout.width,
        height: layout.height,
        board,
        children: layout.children,
      }
    }),
    ...buildLooseCaptureItems(artifacts, sizingMode).map((item) => ({
      id: item.artifact.id,
      kind: 'capture' as const,
      width: item.width,
      height: item.height,
      artifact: item.artifact,
    })),
  ]

  const rows: typeof normalizedItems[] = []
  let currentRow: typeof normalizedItems = []
  let currentRowWidth = 0

  for (const item of normalizedItems) {
    const nextWidth = currentRow.length > 0 ? currentRowWidth + ITEM_GAP + item.width : item.width
    if (nextWidth > MAX_ROW_WIDTH && currentRow.length > 0) {
      rows.push(currentRow)
      currentRow = [item]
      currentRowWidth = item.width
    } else {
      currentRow.push(item)
      currentRowWidth = nextWidth
    }
  }

  if (currentRow.length > 0) rows.push(currentRow)

  const rowHeights = rows.map((row) => Math.max(...row.map((item) => item.height)))
  const rowWidths = rows.map((row) => row.reduce((sum, item) => sum + item.width, 0) + (row.length - 1) * ITEM_GAP)

  const items: Array<PlacementPlanCaptureItem | PlacementPlanBoardItem> = []
  let rowY = 0

  rows.forEach((row, rowIndex) => {
    let x = 0

    row.forEach((item) => {
      if (item.kind === 'board' && item.board && item.children) {
        items.push({
          type: 'board',
          board: item.board,
          x,
          y: rowY,
          width: item.width,
          height: item.height,
          children: item.children,
        })
      } else if (item.artifact) {
        items.push({
          type: 'capture',
          artifact: item.artifact,
          x,
          y: rowY,
          width: item.width,
          height: item.height,
        })
      }

      x += item.width + ITEM_GAP
    })

    rowY += rowHeights[rowIndex] + ITEM_GAP
  })

  const captureIds = [
    ...artifacts.map((artifact) => artifact.id),
    ...boards.flatMap((board) => board.artifacts.map((artifact) => artifact.id)),
  ]

  return {
    width: Math.max(...rowWidths, 0),
    height: rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(0, rows.length - 1) * ITEM_GAP,
    items,
    captureIds: Array.from(new Set(captureIds)),
    containsBoards: boards.length > 0,
  }
}

async function createBoardRecord(canvasId: string, boardName: string, frameShapeId: string) {
  const createBoardResponse = await fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: boardName, canvasId, frameShapeId }),
  })

  if (!createBoardResponse.ok) {
    throw new Error('Failed to create board record')
  }

  return createBoardResponse.json() as Promise<{ id: string }>
}

function createImageAsset(editor: Editor, artifact: HoldingCellArtifact) {
  const src = artifact.previewUrl || artifact.url
  if (!src) return null

  const assetId = AssetRecordType.createId()

  editor.createAssets([
    {
      id: assetId,
      type: 'image',
      typeName: 'asset',
      props: {
        name: artifact.title || artifact.siteName || 'Send to Grain image',
        src,
        w: artifact.width,
        h: artifact.height,
        mimeType: null,
        isAnimated: false,
      },
      meta: {},
    },
  ])

  return assetId
}

function createBookmarkAsset(editor: Editor, artifact: HoldingCellArtifact) {
  if (!artifact.url) return null

  const assetId = AssetRecordType.createId()
  editor.createAssets([
    {
      id: assetId,
      typeName: 'asset',
      type: 'bookmark',
      props: {
        src: artifact.url,
        title: artifact.title || artifact.siteName || artifact.url,
        description: artifact.description || '',
        image: artifact.previewUrl || '',
        favicon: artifact.siteName
          ? `https://www.google.com/s2/favicons?domain=${artifact.siteName}&sz=64`
          : '',
      },
      meta: {},
    },
  ])

  return assetId
}

function createCaptureShape(
  editor: Editor,
  artifact: HoldingCellArtifact,
  position: { x: number; y: number },
  parentId: TLParentId,
  boardId?: string,
  dimensions?: { width: number; height: number }
): TLShapeId {
  const width = dimensions?.width ?? artifact.width
  const height = dimensions?.height ?? artifact.height

  if (artifact.kind === 'image') {
    const assetId = createImageAsset(editor, artifact)
    if (!assetId) {
      const shapeId = createShapeId()
      editor.createShape({
        id: shapeId,
        type: 'bookmark',
        parentId,
        x: position.x,
        y: position.y,
        props: {
          w: DEFAULT_BOOKMARK_WIDTH,
          h: DEFAULT_BOOKMARK_HEIGHT,
          url: artifact.url,
          assetId: null,
        },
        meta: boardId ? { boardId } : {},
      })
      return shapeId
    }

    const shapeId = createShapeId()
    editor.createShape({
      id: shapeId,
      type: 'image',
      parentId,
      x: position.x,
      y: position.y,
      props: {
        assetId,
        w: width,
        h: height,
      },
      meta: boardId ? { boardId } : {},
    })
    return shapeId
  }

  const bookmarkAssetId = createBookmarkAsset(editor, artifact)
  const shapeId = createShapeId()

  editor.createShape({
    id: shapeId,
    type: 'bookmark',
    parentId,
    x: position.x,
    y: position.y,
    props: {
      w: width,
      h: height,
      url: artifact.url,
      assetId: bookmarkAssetId,
    },
    meta: boardId ? { boardId } : {},
  })

  return shapeId
}

export function findBoardOverlap(editor: Editor, pageId: TLPageId, anchor: { x: number; y: number }, plan: PlacementPlan) {
  const planBounds = {
    minX: anchor.x,
    minY: anchor.y,
    maxX: anchor.x + plan.width,
    maxY: anchor.y + plan.height,
  }

  const frames = editor
    .getSortedChildIdsForParent(pageId)
    .map((id) => editor.getShape(id))
    .filter((shape): shape is TLFrameShape => !!shape && shape.type === 'frame')

  return (
    frames.find((frame) => {
      const bounds = editor.getShapePageBounds(frame)
      if (!bounds) return false

      return !(
        planBounds.maxX < bounds.minX ||
        planBounds.minX > bounds.maxX ||
        planBounds.maxY < bounds.minY ||
        planBounds.minY > bounds.maxY
      )
    }) || null
  )
}

export async function commitPlacementPlan({
  editor,
  canvasId,
  pageId,
  anchor,
  plan,
  targetBoardFrame,
}: {
  editor: Editor
  canvasId: string
  pageId: TLPageId
  anchor: { x: number; y: number }
  plan: PlacementPlan
  targetBoardFrame?: TLFrameShape | null
}) {
  const selectedShapeIds: TLShapeId[] = []
  const targetBoardId = targetBoardFrame ? getBoardIdFromMeta(targetBoardFrame) : undefined
  const targetParentId = targetBoardFrame ? targetBoardFrame.id : pageId

  for (const item of plan.items) {
    if (item.type === 'board') {
      const frameId = createShapeId()
      const { id: boardId } = await createBoardRecord(canvasId, item.board.board_name, frameId)
      const frameX = anchor.x + item.x
      const frameY = anchor.y + item.y

      editor.createShape({
        id: frameId,
        type: 'frame',
        parentId: pageId,
        x: frameX,
        y: frameY,
        meta: { boardId },
        props: {
          w: item.width,
          h: item.height,
          name: item.board.board_name,
        },
      })
      selectedShapeIds.push(frameId)

      item.children.forEach((child) => {
        const childShapeId = createCaptureShape(
          editor,
          child.artifact,
          { x: child.x, y: child.y },
          frameId,
          boardId,
          { width: child.width, height: child.height }
        )
        selectedShapeIds.push(childShapeId)
      })

      continue
    }

    const position = targetBoardFrame
      ? {
          x: anchor.x + item.x - targetBoardFrame.x,
          y: anchor.y + item.y - targetBoardFrame.y,
        }
      : {
          x: anchor.x + item.x,
          y: anchor.y + item.y,
        }

    const createdId = createCaptureShape(
      editor,
      item.artifact,
      position,
      targetParentId,
      targetBoardId,
      { width: item.width, height: item.height }
    )
    selectedShapeIds.push(createdId)
  }

  if (selectedShapeIds.length > 0) {
    editor.select(...selectedShapeIds)
  }

  return {
    captureIds: plan.captureIds,
    selectedShapeIds,
  }
}

export async function applyPendingCaptures(editor: Editor, captures: PendingCapture[]) {
  const artifacts = captures.map((capture) => pendingCaptureToArtifact(capture))
  const plan = buildPlacementPlan({ artifacts, boards: [] })
  const pageId = getTargetPageId(editor, captures[0])
  const result = await commitPlacementPlan({
    editor,
    canvasId: captures[0]?.canvas_id || '',
    pageId,
    anchor: { x: 64, y: 96 },
    plan,
    targetBoardFrame: null,
  })

  return result.captureIds
}
