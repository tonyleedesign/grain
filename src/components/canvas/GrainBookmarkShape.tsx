'use client'

import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  BookmarkShapeUtil,
  HTMLContainer,
  TLAssetId,
  TLBookmarkAsset,
  TLBookmarkShape,
  TLResizeInfo,
  resizeBox,
  useEditor,
} from 'tldraw'
import { ExternalLink, Link2 } from 'lucide-react'
import './grain-bookmark.css'

const MIN_BOOKMARK_WIDTH = 220
const MIN_BOOKMARK_HEIGHT = 120

function getReadableUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function stopHandledPointerEvent(editor: ReturnType<typeof useEditor>, e: ReactPointerEvent) {
  if (!editor.inputs.getShiftKey()) {
    editor.markEventAsHandled(e)
  }
}

function openBookmarkUrl(
  editor: ReturnType<typeof useEditor>,
  e: ReactPointerEvent,
  url: string
) {
  e.stopPropagation()
  stopHandledPointerEvent(editor, e)
  window.open(url, '_blank', 'noopener,noreferrer')
}

function GrainBookmarkCard({
  assetId,
  url,
  width,
  height,
}: {
  assetId: TLAssetId | null
  url: string
  width: number
  height: number
}) {
  const editor = useEditor()
  const asset = assetId ? (editor.getAsset(assetId) as TLBookmarkAsset | null) : null
  const title = asset?.props.title?.trim() || getReadableUrl(url)
  const description = asset?.props.description?.trim() || ''
  const previewImage = asset?.props.image || ''
  const largeCard = width >= 320 && height >= 220
  const showDescription = Boolean(description) && largeCard

  return (
    <HTMLContainer>
      <div
        className="grain-bookmark-card"
        style={{
          width,
          height,
        }}
      >
        <div className="grain-bookmark-card__image-link">
          {previewImage ? (
            <img
              className="grain-bookmark-card__image"
              src={previewImage}
              alt={title}
              referrerPolicy="strict-origin-when-cross-origin"
              draggable={false}
            />
          ) : (
            <div className="grain-bookmark-card__placeholder">
              <div className="grain-bookmark-card__placeholder-badge">
                <Link2 size={16} />
              </div>
              <div className="grain-bookmark-card__placeholder-text">{title}</div>
            </div>
          )}
          <button
            type="button"
            className="grain-bookmark-card__launch"
            onPointerDown={(e) => openBookmarkUrl(editor, e, url)}
            onPointerUp={(e) => stopHandledPointerEvent(editor, e)}
            title={url}
            aria-label={`Open ${title} in a new tab`}
          >
            <ExternalLink size={12} aria-hidden="true" />
          </button>
        </div>

        <div
          className={`grain-bookmark-card__meta${showDescription ? '' : ' grain-bookmark-card__meta--compact'}`}
        >
          <div className="grain-bookmark-card__title" title={title}>
            {title}
          </div>

          {showDescription && (
            <div className="grain-bookmark-card__description" title={description}>
              {description}
            </div>
          )}
        </div>
      </div>
    </HTMLContainer>
  )
}

export class GrainBookmarkShapeUtil extends BookmarkShapeUtil {
  override canResize() {
    return true
  }

  override onResize(shape: TLBookmarkShape, info: TLResizeInfo<TLBookmarkShape>) {
    return resizeBox(shape, info, {
      minWidth: MIN_BOOKMARK_WIDTH,
      minHeight: MIN_BOOKMARK_HEIGHT,
    })
  }

  override component(shape: TLBookmarkShape) {
    return (
      <GrainBookmarkCard
        assetId={shape.props.assetId}
        url={shape.props.url}
        width={shape.props.w}
        height={shape.props.h}
      />
    )
  }
}
