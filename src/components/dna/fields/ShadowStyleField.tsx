'use client'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

type ShadowStyle = 'none' | 'subtle' | 'layered' | 'elevated'

interface ShadowStyleFieldProps {
  style: ShadowStyle
}

const shadowMap: Record<ShadowStyle, string> = {
  none: 'none',
  subtle: '0 1px 3px rgba(0,0,0,0.08)',
  layered: '0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
  elevated: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
}

export function ShadowStyleField({ style }: ShadowStyleFieldProps) {
  return (
    <div>
      <SectionLabel>Shadow Style</SectionLabel>
      <div
        style={{
          width: 80,
          height: 48,
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: shadowMap[style],
        }}
      />
      <div className="text-[11px] text-[var(--color-muted)] mt-1.5">
        {style}
      </div>
    </div>
  )
}
