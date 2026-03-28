// Extract analyzable visual URLs from a tldraw frame by name.
// Used by DNA extraction to send board images and bookmark preview images to Claude.

import { Editor, TLBookmarkAsset, TLImageShape, TLShape, TLShapeId } from 'tldraw'
import { getBoardIdFromMeta } from './board-identity'

interface GetBoardImageUrlsOptions {
  frameName?: string
  frameId?: string
  boardId?: string
}

export function getBoardImageUrls(editor: Editor, options: string | GetBoardImageUrlsOptions): string[] {
  const allShapes = editor.getCurrentPageShapes()
  const config = typeof options === 'string' ? { frameName: options } : options

  const frame = allShapes.find((s) => {
    if (s.type !== 'frame') return false
    if (config.frameId && s.id === config.frameId) return true
    if (config.boardId && getBoardIdFromMeta(s) === config.boardId) return true
    if (config.frameName && (s.props as { name?: string }).name === config.frameName) return true
    return false
  })
  if (!frame) return []

  // Get child visuals inside this frame. DNA extraction can observe native image
  // assets and bookmark preview images, but not arbitrary bookmark URLs.
  const children = editor.getSortedChildIdsForParent(frame.id)
  const urls = new Set<string>()

  for (const childId of children) {
    const shape = editor.getShape(childId as TLShapeId)
    if (!shape) continue

    if (shape.type === 'image') {
      const imgShape = shape as TLImageShape
      const asset = imgShape.props.assetId ? editor.getAsset(imgShape.props.assetId) : null
      const src = (asset?.props as { src?: string })?.src
      if (src) urls.add(src)
      continue
    }

    if (shape.type === 'bookmark') {
      const previewImage = getBookmarkPreviewImage(
        shape.props.assetId ? editor.getAsset(shape.props.assetId) : null
      )
      if (previewImage) urls.add(previewImage)
    }
  }

  return Array.from(urls)
}

function getBookmarkPreviewImage(asset: unknown): string | null {
  const bookmarkAsset = asset as TLBookmarkAsset | null
  const previewImage = bookmarkAsset?.props?.image?.trim()
  return previewImage || null
}

function isCountableBoardArtifact(shape: TLShape | undefined): boolean {
  if (!shape) return false
  return shape.type === 'image' || shape.type === 'bookmark' || shape.type === 'embed'
}

export function getBoardArtifactCount(editor: Editor, options: string | GetBoardImageUrlsOptions): number {
  const allShapes = editor.getCurrentPageShapes()
  const config = typeof options === 'string' ? { frameName: options } : options

  const frame = allShapes.find((s) => {
    if (s.type !== 'frame') return false
    if (config.frameId && s.id === config.frameId) return true
    if (config.boardId && getBoardIdFromMeta(s) === config.boardId) return true
    if (config.frameName && (s.props as { name?: string }).name === config.frameName) return true
    return false
  })

  if (!frame) return 0

  return editor
    .getSortedChildIdsForParent(frame.id)
    .map((childId) => editor.getShape(childId as TLShapeId))
    .filter((shape): shape is TLShape => isCountableBoardArtifact(shape))
    .length
}
