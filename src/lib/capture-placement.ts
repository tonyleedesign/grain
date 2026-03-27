import {
  AssetRecordType,
  Editor,
  createShapeId,
  type TLPageId,
} from 'tldraw'
import type { PendingCapture } from '@/types/captures'

const INBOX_MARGIN_X = 64
const INBOX_MARGIN_Y = 96
const INBOX_GAP_Y = 24
const DEFAULT_IMAGE_WIDTH = 280
const DEFAULT_BOOKMARK_WIDTH = 320
const DEFAULT_BOOKMARK_HEIGHT = 220

function getTopLevelPageShapes(editor: Editor, pageId: TLPageId) {
  return editor
    .getSortedChildIdsForParent(pageId)
    .map((id) => editor.getShape(id))
    .filter((shape): shape is NonNullable<typeof shape> => !!shape)
}

function getTargetPageId(editor: Editor, capture: PendingCapture): TLPageId {
  const pageId =
    typeof capture.metadata?.targetPageId === 'string' ? capture.metadata.targetPageId : null

  if (pageId && editor.getPage(pageId as TLPageId)) {
    return pageId as TLPageId
  }

  return editor.getCurrentPageId()
}

function getInboxOrigin(editor: Editor, pageId: TLPageId, itemCount: number) {
  const shapes = getTopLevelPageShapes(editor, pageId)
  const frames = shapes.filter((shape) => shape.type === 'frame')
  const isCurrentPage = pageId === editor.getCurrentPageId()

  if (isCurrentPage) {
    const viewportPageBounds = editor.getViewportPageBounds()
    const maxInboxX = viewportPageBounds.maxX - DEFAULT_BOOKMARK_WIDTH - INBOX_MARGIN_X
    const minInboxX = viewportPageBounds.minX + INBOX_MARGIN_X
    const minInboxY = viewportPageBounds.minY + INBOX_MARGIN_Y

    const visibleFrames = frames.filter((shape) => {
      const width = (shape.props as { w?: number }).w || 0
      const height = (shape.props as { h?: number }).h || 0
      const frameRight = shape.x + width
      const frameBottom = shape.y + height

      return !(
        frameRight < viewportPageBounds.minX ||
        shape.x > viewportPageBounds.maxX ||
        frameBottom < viewportPageBounds.minY ||
        shape.y > viewportPageBounds.maxY
      )
    })

    if (visibleFrames.length > 0) {
      const rightEdge = Math.max(
        ...visibleFrames.map((shape) => shape.x + ((shape.props as { w?: number }).w || 0))
      )
      const topEdge = Math.min(...visibleFrames.map((shape) => shape.y))
      return {
        x: Math.max(minInboxX, Math.min(maxInboxX, rightEdge + INBOX_MARGIN_X)),
        y: Math.max(minInboxY, topEdge),
      }
    }

    return {
      x: Math.max(minInboxX, maxInboxX),
      y: minInboxY + itemCount * INBOX_GAP_Y,
    }
  }

  if (frames.length > 0) {
    const rightEdge = Math.max(
      ...frames.map((shape) => shape.x + ((shape.props as { w?: number }).w || 0))
    )
    const topEdge = Math.min(...frames.map((shape) => shape.y))
    return {
      x: rightEdge + INBOX_MARGIN_X,
      y: topEdge + INBOX_MARGIN_Y,
    }
  }

  const shapeBounds = shapes
    .map((shape) => editor.getShapePageBounds(shape))
    .filter((bounds): bounds is NonNullable<typeof bounds> => !!bounds)

  if (shapeBounds.length > 0) {
    const maxX = Math.max(...shapeBounds.map((bounds) => bounds.maxX))
    const minY = Math.min(...shapeBounds.map((bounds) => bounds.minY))
    return {
      x: maxX + INBOX_MARGIN_X,
      y: minY + INBOX_MARGIN_Y,
    }
  }

  return {
    x: INBOX_MARGIN_X,
    y: INBOX_MARGIN_Y + itemCount * INBOX_GAP_Y,
  }
}

function getImageDimensions(capture: PendingCapture) {
  const metadata = capture.metadata || {}
  const width =
    typeof metadata.width === 'number' && metadata.width > 0 ? metadata.width : DEFAULT_IMAGE_WIDTH
  const height =
    typeof metadata.height === 'number' && metadata.height > 0
      ? metadata.height
      : Math.round(width * 0.75)

  const scaledWidth = Math.min(width, DEFAULT_IMAGE_WIDTH)
  const scaledHeight = Math.max(160, Math.round((height / width) * scaledWidth))

  return { width: scaledWidth, height: scaledHeight }
}

async function placeImageCapture(
  editor: Editor,
  capture: PendingCapture,
  pageId: TLPageId,
  position: { x: number; y: number }
) {
  const src = capture.preview_image_url || capture.original_url
  if (!src) {
    editor.createShape({
      id: createShapeId(),
      type: 'bookmark',
      parentId: pageId,
      x: position.x,
      y: position.y,
      props: {
        w: DEFAULT_BOOKMARK_WIDTH,
        h: DEFAULT_BOOKMARK_HEIGHT,
        url: capture.canonical_url || capture.original_url || '',
        assetId: null,
      },
      meta: {},
    })
    return { height: 240 }
  }

  const { width, height } = getImageDimensions(capture)
  const assetId = AssetRecordType.createId()

  editor.createAssets([
    {
      id: assetId,
      type: 'image',
      typeName: 'asset',
      props: {
        name: capture.title || capture.site_name || 'Send to Grain image',
        src,
        w: width,
        h: height,
        mimeType: null,
        isAnimated: false,
      },
      meta: {},
    },
  ])

  editor.createShape({
    id: createShapeId(),
    type: 'image',
    parentId: pageId,
    x: position.x,
    y: position.y,
    props: {
      assetId,
      w: width,
      h: height,
    },
    meta: {},
  })

  return { height }
}

async function placeBookmarkCapture(
  editor: Editor,
  capture: PendingCapture,
  pageId: TLPageId,
  position: { x: number; y: number }
) {
  const url = capture.canonical_url || capture.original_url
  if (!url) return { height: 220 }

  const title = capture.title || capture.site_name || url
  const description =
    (typeof capture.metadata?.description === 'string' && capture.metadata.description) ||
    capture.site_name ||
    ''
  const previewImage = capture.preview_image_url || ''
  const favicon =
    (typeof capture.metadata?.favicon === 'string' && capture.metadata.favicon) ||
    (capture.site_name ? `https://www.google.com/s2/favicons?domain=${capture.site_name}&sz=64` : '')

  if (previewImage || title || description) {
    const assetId = AssetRecordType.createId()
    editor.createAssets([
      {
        id: assetId,
        typeName: 'asset',
        type: 'bookmark',
        props: {
          src: url,
          title,
          description,
          image: previewImage,
          favicon,
        },
        meta: {},
      },
    ])

    editor.createShape({
      id: createShapeId(),
      type: 'bookmark',
      parentId: pageId,
      x: position.x,
      y: position.y,
      props: {
        w: DEFAULT_BOOKMARK_WIDTH,
        h: DEFAULT_BOOKMARK_HEIGHT,
        assetId,
        url,
      },
      meta: {},
    })

    return { height: DEFAULT_BOOKMARK_HEIGHT }
  }

  editor.createShape({
    id: createShapeId(),
    type: 'bookmark',
    parentId: pageId,
    x: position.x,
    y: position.y,
    props: {
      w: DEFAULT_BOOKMARK_WIDTH,
      h: DEFAULT_BOOKMARK_HEIGHT,
      url,
      assetId: null,
    },
    meta: {},
  })

  return { height: DEFAULT_BOOKMARK_HEIGHT }
}

export async function applyPendingCaptures(editor: Editor, captures: PendingCapture[]) {
  const appliedIds: string[] = []
  const groupedCounts = new Map<string, number>()

  for (const capture of captures) {
    const pageId = getTargetPageId(editor, capture)
    groupedCounts.set(pageId, (groupedCounts.get(pageId) || 0) + 1)
  }

  const origins = new Map<string, { x: number; y: number }>()
  const nextYByPage = new Map<string, number>()

  for (const capture of captures) {
    const pageId = getTargetPageId(editor, capture)

    if (!origins.has(pageId)) {
      const origin = getInboxOrigin(editor, pageId, groupedCounts.get(pageId) || 1)
      origins.set(pageId, origin)
      nextYByPage.set(pageId, origin.y)
    }

    const position = {
      x: origins.get(pageId)!.x,
      y: nextYByPage.get(pageId)!,
    }

    try {
      if (capture.content_kind === 'image') {
        const { height } = await placeImageCapture(editor, capture, pageId, position)
        nextYByPage.set(pageId, position.y + height + INBOX_GAP_Y)
        appliedIds.push(capture.id)
        continue
      }

      const { height } = await placeBookmarkCapture(editor, capture, pageId, position)
      nextYByPage.set(pageId, position.y + height + INBOX_GAP_Y)
      appliedIds.push(capture.id)
    } catch (error) {
      console.error('Failed to place pending capture', capture.id, error)
    }
  }

  return appliedIds
}
