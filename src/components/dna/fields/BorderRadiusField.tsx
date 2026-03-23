'use client'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

interface BorderRadiusFieldProps {
  radius: number
}

export function BorderRadiusField({ radius }: BorderRadiusFieldProps) {
  const avatarRadius = radius >= 20 ? '50%' : `${radius}px`

  return (
    <div>
      <SectionLabel>Border Radius</SectionLabel>
      <div className="flex items-end gap-3">
        {/* Card */}
        <div
          style={{
            width: 48,
            height: 32,
            borderRadius: `${radius}px`,
            border: '1.5px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        />

        {/* Button */}
        <div
          style={{
            width: 64,
            height: 28,
            borderRadius: `${radius}px`,
            border: '1.5px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        />

        {/* Input */}
        <div
          style={{
            width: 64,
            height: 28,
            borderRadius: `${radius}px`,
            border: '1.5px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        />

        {/* Avatar */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: avatarRadius,
            border: '1.5px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        />
      </div>
      <div className="text-[11px] text-[var(--color-muted)] mt-1.5">
        {radius}px
      </div>
    </div>
  )
}
