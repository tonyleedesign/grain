// Extract image URLs from a tldraw frame by name.
// Used by DNA extraction to send board images to Claude.

import { Editor, TLShapeId, TLImageShape } from 'tldraw'
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

  // Get child image shapes inside this frame
  const children = editor.getSortedChildIdsForParent(frame.id)
  const urls: string[] = []

  for (const childId of children) {
    const shape = editor.getShape(childId as TLShapeId)
    if (!shape || shape.type !== 'image') continue
    const imgShape = shape as TLImageShape
    const asset = imgShape.props.assetId
      ? editor.getAsset(imgShape.props.assetId)
      : null
    const src = (asset?.props as { src?: string })?.src
    if (src) urls.push(src)
  }

  return urls
}
