'use client'

import { Editor, TLBookmarkAsset, TLImageShape, TLShape, TLShapeId, createShapeId } from 'tldraw'
import { clearBoardLinkFromShape, getBoardIdFromMeta, hasLiveBoardFrame } from './board-identity'
import type {
  OrganizeArtifactInput,
  OrganizeArtifactKind,
  OrganizeArtifactPreview,
  OrganizePlanBoardPreview,
  OrganizePlanResponse,
} from '@/types/organize'
import type { PlacementPlan } from '@/types/holding-cell'

const BOARD_PADDING = 24
const ITEM_GAP = 12
const HEADER_HEIGHT = 40
const MAX_ROW_WIDTH = 900
const TARGET_IMAGE_HEIGHT = 250
const MAX_LINK_WIDTH = 320
const MAX_LINK_HEIGHT = 220

function isUngroupedArtifact(editor: Editor, shape: TLShape) {
  if (shape.type !== 'image' && shape.type !== 'bookmark' && shape.type !== 'embed') {
    return false
  }

  const boardId = getBoardIdFromMeta(shape)
  if (boardId) {
    if (!hasLiveBoardFrame(editor, boardId)) {
      clearBoardLinkFromShape(editor, shape)
    } else {
      return false
    }
  }

  const parentShape = editor.getShape(shape.parentId as TLShapeId)
  return !parentShape || parentShape.type !== 'frame'
}

function getArtifactKind(shape: TLShape): OrganizeArtifactKind {
  if (shape.type === 'image') return 'image'
  if (shape.type === 'embed') return 'embed'
  return 'bookmark'
}

function getArtifactBounds(editor: Editor, shape: TLShape) {
  const bounds = editor.getShapePageBounds(shape)
  if (!bounds) {
    return { width: MAX_LINK_WIDTH, height: MAX_LINK_HEIGHT }
  }

  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  }
}

function getImageSource(editor: Editor, shape: TLImageShape) {
  const asset = shape.props.assetId ? editor.getAsset(shape.props.assetId) : null
  return (asset?.props as { src?: string })?.src || ''
}

function getBookmarkAsset(editor: Editor, shape: TLShape) {
  const props = shape.props as { assetId?: string | null }
  if (!props.assetId) return null
  return editor.getAsset(props.assetId as Parameters<Editor['getAsset']>[0]) as TLBookmarkAsset | null
}

export function getUngroupedImages(editor: Editor): TLImageShape[] {
  return editor.getCurrentPageShapes().filter((shape): shape is TLImageShape => {
    return shape.type === 'image' && isUngroupedArtifact(editor, shape)
  })
}

export function getUngroupedOrganizeArtifacts(editor: Editor): TLShape[] {
  return editor.getCurrentPageShapes().filter((shape) => isUngroupedArtifact(editor, shape))
}

export function getUngroupedOrganizeArtifactPreviews(editor: Editor): OrganizeArtifactPreview[] {
  return getUngroupedOrganizeArtifacts(editor).map((shape) => {
    const kind = getArtifactKind(shape)
    const { width, height } = getArtifactBounds(editor, shape)

    if (shape.type === 'image') {
      return {
        id: shape.id,
        kind,
        url: getImageSource(editor, shape),
        position_x: shape.x,
        position_y: shape.y,
        width,
        height,
      }
    }

    const props = shape.props as { url?: string }
    const asset = shape.type === 'bookmark' ? getBookmarkAsset(editor, shape) : null

    return {
      id: shape.id,
      kind,
      url: props.url || '',
      previewUrl: asset?.props.image || undefined,
      title: asset?.props.title || undefined,
      description: asset?.props.description || undefined,
      position_x: shape.x,
      position_y: shape.y,
      width,
      height,
    }
  })
}

function buildOrganizeInput(artifacts: OrganizeArtifactPreview[]): OrganizeArtifactInput[] {
  return artifacts.map((artifact) => ({
    id: artifact.id,
    kind: artifact.kind,
    url: artifact.url,
    previewUrl: artifact.previewUrl,
    title: artifact.title,
    description: artifact.description,
    position_x: artifact.position_x,
    position_y: artifact.position_y,
  }))
}

export async function requestArtifactOrganizePlan(
  artifacts: OrganizeArtifactInput[],
  canvasId: string,
  artifactPreviewMap: Map<string, OrganizeArtifactPreview>
): Promise<OrganizePlanBoardPreview[] | null> {
  if (artifacts.length === 0) return null

  const response = await fetch('/api/organize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artifacts, canvasId }),
    signal: AbortSignal.timeout(45000),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.error || 'Organize failed')
  }

  const result = (await response.json()) as OrganizePlanResponse

  return result.boards.map((board) => ({
    ...board,
    artifacts: board.artifact_ids
      .map((artifactId) => artifactPreviewMap.get(artifactId))
      .filter((artifact): artifact is OrganizeArtifactPreview => !!artifact),
  }))
}

export async function requestOrganizePlan(
  editor: Editor,
  canvasId: string
): Promise<OrganizePlanBoardPreview[] | null> {
  const artifacts = getUngroupedOrganizeArtifactPreviews(editor)
  if (artifacts.length === 0) return null
  const artifactMap = new Map(artifacts.map((artifact) => [artifact.id, artifact]))
  return requestArtifactOrganizePlan(buildOrganizeInput(artifacts), canvasId, artifactMap)
}

function getLayoutDimensions(artifact: OrganizeArtifactPreview) {
  if (artifact.kind === 'image') {
    const aspect = artifact.width / Math.max(artifact.height, 1)
    return {
      width: Math.max(120, Math.round(TARGET_IMAGE_HEIGHT * aspect)),
      height: TARGET_IMAGE_HEIGHT,
    }
  }

  const scale = Math.min(MAX_LINK_WIDTH / artifact.width, MAX_LINK_HEIGHT / artifact.height, 1)
  return {
    width: Math.max(180, Math.round(artifact.width * scale)),
    height: Math.max(120, Math.round(artifact.height * scale)),
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

export async function applyOrganizePlan(
  editor: Editor,
  canvasId: string,
  selectedBoards: OrganizePlanBoardPreview[],
  options?: {
    anchor?: { x: number; y: number }
    plan?: PlacementPlan
    preserveDimensions?: boolean
  }
) {
  for (const board of selectedBoards) {
    if (!board.artifacts.length) continue

    const shapeMap = new Map(
      board.artifacts
        .map((artifact) => {
          const shape = editor.getShape(artifact.id as TLShapeId)
          return shape ? [artifact.id, shape] : null
        })
        .filter((entry): entry is [string, TLShape] => !!entry)
    )

    const artifacts = board.artifacts.filter((artifact) => shapeMap.has(artifact.id))
    if (!artifacts.length) continue

    const laidOut = artifacts.map((artifact) => ({
      artifact,
      ...getLayoutDimensions(artifact),
      shape: shapeMap.get(artifact.id)!,
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

    const plannedBoardItem = options?.plan?.items.find(
      (item): item is PlacementPlan['items'][number] & { type: 'board' } => item.type === 'board' && item.board.id === board.id
    )
    const rowWidths = rows.map((row) => row.reduce((sum, item) => sum + item.width, 0) + (row.length - 1) * ITEM_GAP)
    const rowHeights = rows.map((row) => Math.max(...row.map((item) => item.height)))
    const computedFrameW = Math.max(...rowWidths, 240) + BOARD_PADDING * 2
    const computedFrameH = rowHeights.reduce((sum, height) => sum + height, 0) + (rows.length - 1) * ITEM_GAP + BOARD_PADDING * 2 + HEADER_HEIGHT
    const frameW = plannedBoardItem?.width ?? computedFrameW
    const frameH = plannedBoardItem?.height ?? computedFrameH
    const frameX = options?.anchor && plannedBoardItem
      ? options.anchor.x + plannedBoardItem.x
      : (artifacts.reduce((sum, artifact) => sum + artifact.position_x, 0) / artifacts.length) - frameW / 2
    const frameY = options?.anchor && plannedBoardItem
      ? options.anchor.y + plannedBoardItem.y
      : (artifacts.reduce((sum, artifact) => sum + artifact.position_y, 0) / artifacts.length) - frameH / 2

    const frameId = createShapeId()
    const { id: boardId } = await createBoardRecord(canvasId, board.board_name, frameId)

    editor.run(() => {
      editor.createShape({
        id: frameId,
        type: 'frame',
        x: frameX,
        y: frameY,
        meta: { boardId },
        props: {
          w: frameW,
          h: frameH,
          name: board.board_name,
        },
      })

      let rowY = BOARD_PADDING + HEADER_HEIGHT
      rows.forEach((row, rowIndex) => {
        let x = BOARD_PADDING
        row.forEach((item) => {
          const plannedChild = plannedBoardItem?.children.find((child) => child.artifact.id === item.artifact.id)
          const baseUpdate = {
            id: item.shape.id,
            type: item.shape.type,
            parentId: frameId,
            x: plannedChild?.x ?? x,
            y: plannedChild?.y ?? rowY,
          }

          if (item.shape.type === 'image') {
            editor.updateShape({
              ...baseUpdate,
              type: 'image',
              props: options?.preserveDimensions
                ? item.shape.props
                : {
                    ...item.shape.props,
                    w: plannedChild?.width ?? item.width,
                    h: plannedChild?.height ?? item.height,
                  },
            })
          } else if (item.shape.type === 'bookmark') {
            editor.updateShape({
              ...baseUpdate,
              type: 'bookmark',
              props: options?.preserveDimensions
                ? item.shape.props
                : {
                    ...item.shape.props,
                    w: plannedChild?.width ?? item.width,
                    h: plannedChild?.height ?? item.height,
                  },
            })
          } else if (item.shape.type === 'embed') {
            editor.updateShape({
              ...baseUpdate,
              type: 'embed',
              props: options?.preserveDimensions
                ? item.shape.props
                : {
                    ...item.shape.props,
                    w: plannedChild?.width ?? item.width,
                    h: plannedChild?.height ?? item.height,
                  },
            })
          }

          x += item.width + ITEM_GAP
        })
        rowY += rowHeights[rowIndex] + ITEM_GAP
      })
    })
  }
}
