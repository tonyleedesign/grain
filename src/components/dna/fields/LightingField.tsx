'use client'

import { Badge } from '@/components/ui/badge'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

export function LightingField({ lighting }: { lighting: string[] }) {
  return (
    <div>
      <SectionLabel>Lighting</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {lighting.map((item) => (
          <Badge key={item} variant="outline">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}
