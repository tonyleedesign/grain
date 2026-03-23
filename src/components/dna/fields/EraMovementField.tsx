'use client'

import { Badge } from '@/components/ui/badge'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

export function EraMovementField({
  eraMovement,
}: {
  eraMovement: string[]
}) {
  return (
    <div>
      <SectionLabel>Era / Movement</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {eraMovement.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}
