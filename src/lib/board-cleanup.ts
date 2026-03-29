import { Editor, TLShape, TLShapeId } from 'tldraw'
import { getBoardIdFromMeta } from './board-identity'

const CLEANUP_GAP = 16
const CLEANUP_OFFSET_X = 40
const CLEANUP_COLUMN_GAP = 24

function getShapeSize(editor: Editor, shape: TLShape): { width: number; height: number } {
  if (shape.type === 'ai-text') {
    const props = shape.props as { w?: number; h?: number; mode?: 'simple' | 'chat' }
    return {
      width: props.w || 360,
      height: props.mode === 'chat' ? Math.max(200, props.h || 280) : (props.h || 40),
    }
  }

  if (shape.type === 'snapshot-card') {
    const props = shape.props as { w?: number; h?: number }
    return {
      width: props.w || 240,
      height: props.h || 320,
    }
  }

  const bounds = editor.getShapePageBounds(shape)
  if (bounds) {
    return {
      width: bounds.width,
      height: bounds.height,
    }
  }

  return { width: 0, height: 0 }
}

export function cleanupBoardArtifacts(editor: Editor, frameId: TLShapeId): number {
  const frame = editor.getShape(frameId)
  if (!frame || frame.type !== 'frame') return 0

  const boardId = getBoardIdFromMeta(frame)
  if (!boardId) return 0
  const pageId = editor.getCurrentPageId()

  const frameProps = frame.props as { w?: number; h?: number }
  const artifactShapes = editor
    .getCurrentPageShapes()
    .filter((shape) => {
      if (shape.id === frameId) return false
      if (
        shape.type !== 'ai-text' &&
        shape.type !== 'snapshot-card' &&
        shape.type !== 'bookmark' &&
        shape.type !== 'embed'
      ) {
        return false
      }

      const shapeBoardId =
        shape.type === 'ai-text' || shape.type === 'snapshot-card'
          ? (shape.props as { boardId?: string }).boardId
          : getBoardIdFromMeta(shape)
      return shapeBoardId === boardId
    })
    .sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y
      return a.x - b.x
    })

  if (artifactShapes.length === 0) return 0

  const aiShapes = artifactShapes.filter((shape) => shape.type === 'ai-text')
  const snapshotShapes = artifactShapes.filter((shape) => shape.type === 'snapshot-card')
  const linkShapes = artifactShapes.filter((shape) => {
    if (shape.type !== 'bookmark' && shape.type !== 'embed') return false
    return shape.parentId !== frameId
  })
  const movableCount = aiShapes.length + snapshotShapes.length + linkShapes.length

  if (movableCount === 0) return 0

  const baseX = frame.x + (frameProps.w || 0) + CLEANUP_OFFSET_X
  let nextAiY = frame.y

  let maxAiWidth = 0
  for (const artifact of aiShapes) {
    const { width, height } = getShapeSize(editor, artifact)
    maxAiWidth = Math.max(maxAiWidth, width)
    editor.updateShape({
      id: artifact.id,
      type: artifact.type,
      parentId: pageId,
      x: baseX,
      y: nextAiY,
    })

    nextAiY += height + CLEANUP_GAP
  }

  const snapshotX = baseX + (maxAiWidth > 0 ? maxAiWidth + CLEANUP_COLUMN_GAP : 0)
  let nextSnapshotY = frame.y

  let maxSnapshotWidth = 0
  for (const artifact of snapshotShapes) {
    const { width, height } = getShapeSize(editor, artifact)
    maxSnapshotWidth = Math.max(maxSnapshotWidth, width)
    editor.updateShape({
      id: artifact.id,
      type: artifact.type,
      parentId: pageId,
      x: snapshotX,
      y: nextSnapshotY,
    })

    nextSnapshotY += height + CLEANUP_GAP
  }

  const linkX = snapshotX + (maxSnapshotWidth > 0 ? maxSnapshotWidth + CLEANUP_COLUMN_GAP : 0)
  let nextLinkY = frame.y

  for (const artifact of linkShapes) {
    const { height } = getShapeSize(editor, artifact)
    editor.updateShape({
      id: artifact.id,
      type: artifact.type,
      parentId: pageId,
      x: linkX,
      y: nextLinkY,
    })

    nextLinkY += height + CLEANUP_GAP
  }

  return movableCount
}
