'use client'

import type { DesignMDTokens, TypographyToken } from '@/types/dna'

export function TokensPanel({ tokens }: { tokens: DesignMDTokens }) {
  return (
    <div className="flex flex-col gap-5">
      <ColorSwatches colors={tokens.colors} />
      <TypographyScale typography={tokens.typography} />
      <ScaleRow label="Spacing" scale={tokens.spacing} />
      <ScaleRow label="Radius" scale={tokens.rounded} />
    </div>
  )
}

function ColorSwatches({ colors }: { colors: Record<string, string> }) {
  const entries = Object.entries(colors)
  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
        Colors
      </span>
      <div className="flex gap-2 flex-wrap">
        {entries.map(([name, hex]) => (
          <div key={name} className="flex flex-col gap-1 items-center">
            <div
              className="w-10 h-10 rounded-md"
              style={{
                backgroundColor: hex,
                border: '1px solid var(--color-border)',
              }}
              title={`${name}: ${hex}`}
            />
            <span className="text-[9px] text-center max-w-14" style={{ color: 'var(--color-muted)' }}>
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TypographyScale({ typography }: { typography: DesignMDTokens['typography'] }) {
  const levels = ['headline-display', 'headline-lg', 'body-lg', 'body-md', 'label-md'] as const
  const entries = levels.map((level) => [level, typography[level]] as const).filter(([, token]) => !!token)
  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
        Typography
      </span>
      <div className="flex flex-col gap-2">
        {entries.map(([level, token]) => (
          <TypographyRow key={level} level={level} token={token!} />
        ))}
      </div>
    </div>
  )
}

function TypographyRow({ level, token }: { level: string; token: TypographyToken }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="min-w-0 flex-1 truncate"
        style={{
          fontFamily: `'${token.fontFamily}', sans-serif`,
          fontSize: level.startsWith('headline') ? 16 : 13,
          fontWeight: token.fontWeight,
          color: 'var(--color-text)',
          lineHeight: 1.3,
        }}
      >
        {level}
      </span>
      <span className="text-[10px] shrink-0" style={{ color: 'var(--color-muted)' }}>
        {token.fontFamily} · {token.fontSize} · {token.fontWeight}
      </span>
    </div>
  )
}

function ScaleRow({ label, scale }: { label: string; scale: Record<string, string | undefined> }) {
  const entries = Object.entries(scale).filter(([, value]) => !!value)
  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
        {label}
      </span>
      <div className="flex gap-2 flex-wrap">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-col gap-0.5 items-center px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--color-bg)' }}>
            <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{key}</span>
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
