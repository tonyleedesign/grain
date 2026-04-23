'use client'

import type { GrainTheme } from '@/config/theme'

interface ThemePreviewProps {
  theme: GrainTheme
}

export function ThemePreview({ theme }: ThemePreviewProps) {
  const { colors, typography, radius } = theme

  const vars: React.CSSProperties = {
    '--preview-bg': colors.bg,
    '--preview-surface': colors.surface,
    '--preview-accent': colors.accent,
    '--preview-text': colors.text,
    '--preview-muted': colors.muted,
    '--preview-border': colors.border,
    '--preview-radius-sm': radius.sm,
    '--preview-radius-md': radius.md,
    '--preview-radius-lg': radius.lg,
  } as React.CSSProperties

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
        Theme Preview
      </span>

      {typography.fontUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={typography.fontUrl} />
      )}

      <div
        className="rounded-md overflow-hidden"
        style={{
          ...vars,
          backgroundColor: 'var(--preview-bg)',
          border: '1px solid var(--preview-border)',
        }}
      >
        {/* Header strip */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--preview-border)' }}
        >
          <span
            style={{
              fontFamily: `'${typography.displayFontFamily}', sans-serif`,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--preview-text)',
              letterSpacing: '0.01em',
            }}
          >
            {typography.displayFontFamily}
          </span>
          <div className="flex gap-1.5">
            {[colors.bg, colors.surface, colors.accent, colors.text, colors.muted].map((c, i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: '1px solid var(--preview-border)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-4 flex flex-col gap-3">
          {/* Headline */}
          <div
            style={{
              fontFamily: `'${typography.displayFontFamily}', sans-serif`,
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--preview-text)',
              lineHeight: 1.15,
            }}
          >
            Design Preview
          </div>

          {/* Body text */}
          <div
            style={{
              fontFamily: `'${typography.fontFamily}', sans-serif`,
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--preview-muted)',
              lineHeight: 1.5,
            }}
          >
            {typography.fontFamily} — body text at reading size, showing rhythm and legibility in context.
          </div>

          {/* Card + button row */}
          <div className="flex items-center gap-2">
            <div
              className="flex-1 px-3 py-2"
              style={{
                backgroundColor: 'var(--preview-surface)',
                borderRadius: 'var(--preview-radius-md)',
                border: '1px solid var(--preview-border)',
              }}
            >
              <span
                style={{
                  fontFamily: `'${typography.fontFamily}', sans-serif`,
                  fontSize: 10,
                  color: 'var(--preview-text)',
                }}
              >
                Surface card
              </span>
            </div>
            <button
              style={{
                fontFamily: `'${typography.fontFamily}', sans-serif`,
                fontSize: 10,
                fontWeight: 600,
                backgroundColor: 'var(--preview-accent)',
                color: 'var(--preview-bg)',
                border: 'none',
                borderRadius: 'var(--preview-radius-sm)',
                padding: '6px 12px',
                cursor: 'default',
                letterSpacing: '0.04em',
              }}
            >
              ACTION
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
