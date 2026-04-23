'use client'

export function ProseField({ label, content }: { label: string; content: string }) {
  if (!content?.trim()) return null

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
        {label}
      </span>
      <p
        className="text-[13px] leading-relaxed whitespace-pre-wrap m-0"
        style={{ color: 'var(--color-text)' }}
      >
        {content}
      </p>
    </div>
  )
}
