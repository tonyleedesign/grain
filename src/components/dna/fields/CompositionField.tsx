'use client'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

export function CompositionField({
  style,
  description,
}: {
  style: string
  description: string
}) {
  return (
    <div>
      <SectionLabel>Composition</SectionLabel>
      <div className="text-[13px] font-bold text-[var(--color-text)]">
        {style}
      </div>
      <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">
        {description}
      </div>
    </div>
  )
}
