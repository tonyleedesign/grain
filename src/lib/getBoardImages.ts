// Extract image URLs from a tldraw frame by name.
// Used by DNA extraction to send board images to Claude.

import { Editor, TLShapeId, TLImageShape } from 'tldraw'

export function getBoardImageUrls(editor: Editor, frameName: string): string[] {
  const allShapes = editor.getCurrentPageShapes()

  // Find the frame by name
  const frame = allShapes.find(
    (s) => s.type === 'frame' && (s.props as { name?: string }).name === frameName
  )
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
