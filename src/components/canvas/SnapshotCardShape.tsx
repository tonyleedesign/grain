'use client'

// Snapshot Card — custom tldraw shape for frozen DNA snapshots on canvas.
// Created when user clicks "Detach" in the DNA panel.
// Reference: grain-prd.md Section 11.3-11.4

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
    'snapshot-card': SnapshotCardProps
  }
}

// Shape props stored in tldraw
interface SnapshotCardProps {
  w: number
  h: number
  boardName: string
  medium: string // 'web' | 'image'
  directionSummary: string
  moodTags: string  // JSON stringified string[]
  antiPatterns: string // JSON stringified AntiPattern[]
  colorHexes: string // JSON stringified string[]
  fontInfo: string // e.g. "Inter / Playfair Display" or "photography / film stock"
}

export type SnapshotCardShape = TLBaseShape<'snapshot-card', SnapshotCardProps>

export const snapshotCardProps: RecordProps<SnapshotCardShape> = {
  w: T.number,
  h: T.number,
  boardName: T.string,
  medium: T.string,
  directionSummary: T.string,
  moodTags: T.string,
  antiPatterns: T.string,
  colorHexes: T.string,
  fontInfo: T.string,
}

export class SnapshotCardShapeUtil extends ShapeUtil<SnapshotCardShape> {
  static override type = 'snapshot-card' as const
  static override props = snapshotCardProps

  getGeometry(shape: SnapshotCardShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  getDefaultProps(): SnapshotCardProps {
    return {
      w: 240,
      h: 320,
      boardName: 'Untitled',
      medium: 'web',
      directionSummary: '',
      moodTags: '[]',
      antiPatterns: '[]',
      colorHexes: '[]',
      fontInfo: '',
    }
  }

  override canResize() { return true }
  override canEdit() { return false }

  component(shape: SnapshotCardShape) {
    const { boardName, medium, directionSummary, fontInfo } = shape.props
    const colors: string[] = safeJsonParse(shape.props.colorHexes, [])
    const moods: string[] = safeJsonParse(shape.props.moodTags, [])
    const antis: { this_is: string; not_that: string }[] = safeJsonParse(shape.props.antiPatterns, [])

    return (
      <HTMLContainer>
        <div
          style={{
            width: shape.props.w,
            height: shape.props.h,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-card)',
            fontFamily: 'var(--font-family)',
            color: 'var(--color-text)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflow: 'hidden',
            pointerEvents: 'all',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {colors[0] && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors[0], flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {boardName}
            </span>
            <span style={{ fontSize: 9, color: 'var(--color-muted)', marginLeft: 'auto' }}>
              {medium === 'web' ? 'Web/App' : 'Image Gen'}
            </span>
          </div>

          {/* Direction Summary */}
          {directionSummary && (
            <p style={{ fontSize: 12, fontStyle: 'italic', lineHeight: 1.4, margin: 0 }}>
              {directionSummary}
            </p>
          )}

          {/* Color Swatches */}
          {colors.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {colors.slice(0, 5).map((hex, i) => (
                <div
                  key={i}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: hex,
                    border: '1px solid var(--color-border)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Font Info */}
          {fontInfo && (
            <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
              {fontInfo}
            </div>
          )}

          {/* Mood Tags */}
          {moods.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {moods.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Anti-patterns (condensed) */}
          {antis.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {antis.slice(0, 2).map((ap, i) => (
                <div key={i} style={{ fontSize: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ color: '#4a7c4f' }}>&#x2713;</span>
                  <span>{ap.this_is}</span>
                  <span style={{ color: 'var(--color-muted)' }}>|</span>
                  <span style={{ color: '#b44040' }}>&#x2717;</span>
                  <span style={{ color: 'var(--color-muted)' }}>{ap.not_that}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: SnapshotCardShape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={12}
        ry={12}
      />
    )
  }
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}
