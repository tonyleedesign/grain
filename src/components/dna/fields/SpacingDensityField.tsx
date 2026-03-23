'use client'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

type Density = 'compact' | 'comfortable' | 'spacious'

interface SpacingDensityFieldProps {
  density: Density
}

const densityConfig: { id: Density; label: string; gap: number }[] = [
  { id: 'compact', label: 'Compact', gap: 2 },
  { id: 'comfortable', label: 'Comfortable', gap: 6 },
  { id: 'spacious', label: 'Spacious', gap: 10 },
]

export function SpacingDensityField({ density }: SpacingDensityFieldProps) {
  return (
    <div>
      <SectionLabel>Spacing</SectionLabel>
      <div className="flex gap-3">
        {densityConfig.map(({ id, label, gap }) => {
          const isActive = id === density
          return (
            <div key={id} className="flex flex-col items-center gap-1.5">
              {/* Visual: 3 bars with varying gaps */}
              <div
                className="flex flex-col items-center justify-center w-14 h-10 rounded-md"
                style={{
                  border: `1.5px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  backgroundColor: isActive ? 'var(--color-bg)' : 'transparent',
                  gap: `${gap}px`,
                }}
              >
                {[16, 12, 16].map((w, i) => (
                  <div
                    key={i}
                    style={{
                      width: w,
                      height: 2,
                      borderRadius: 1,
                      backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
                    }}
                  />
                ))}
              </div>
              <span
                className="text-[10px] capitalize"
                style={{
                  color: isActive ? 'var(--color-text)' : 'var(--color-muted)',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
