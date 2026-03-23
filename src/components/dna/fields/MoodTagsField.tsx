'use client'

import { Badge } from '@/components/ui/badge'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

interface MoodTagsFieldProps {
  tags: string[]
}

export function MoodTagsField({ tags }: MoodTagsFieldProps) {
  if (!tags.length) return null

  return (
    <div>
      <SectionLabel>Mood</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  )
}
