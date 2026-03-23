'use client'

import { Badge } from '@/components/ui/badge'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

export function MediumTypeField({
  primary,
  subTags,
}: {
  primary: 'photography' | 'illustration' | '3d' | 'mixed'
  subTags: string[]
}) {
  return (
    <div>
      <SectionLabel>Medium Type</SectionLabel>
      <div className="text-[13px] font-semibold capitalize text-[var(--color-text)]">
        {primary}
      </div>
      {subTags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {subTags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
