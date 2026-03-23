'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

const LEVELS = ['clean', 'light', 'moderate', 'heavy'] as const

export function TextureField({
  level,
  keywords,
}: {
  level: 'clean' | 'light' | 'moderate' | 'heavy'
  keywords: string[]
}) {
  const activeIndex = LEVELS.indexOf(level)

  return (
    <div>
      <SectionLabel>Texture</SectionLabel>
      <div className="flex items-center gap-1">
        {LEVELS.map((l, i) => (
          <div
            key={l}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i <= activeIndex
                ? 'bg-[var(--color-text)]'
                : 'bg-[var(--color-border)]'
            )}
          />
        ))}
      </div>
      <div className="mt-1 text-[11px] capitalize text-[var(--color-muted)]">
        {level}
      </div>
      {keywords.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {keywords.map((kw) => (
            <Badge key={kw} variant="secondary">
              {kw}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
