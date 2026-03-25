'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Clapperboard } from 'lucide-react'
import type { WebAppDNA } from '@/types/dna'

interface CreativeDirectionFieldProps {
  creativeDirection: NonNullable<WebAppDNA['creative_direction']>
}

export function CreativeDirectionField({ creativeDirection }: CreativeDirectionFieldProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 mb-2 cursor-pointer"
        style={{ color: 'var(--color-text)' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Clapperboard size={14} style={{ color: 'var(--color-muted)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          Creative Direction
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 pl-1">
          {creativeDirection.map((cd, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div
                className="text-[11px] font-medium"
                style={{ color: 'var(--color-text)' }}
              >
                {cd.section}
              </div>
              <div
                className="text-[11px] leading-relaxed"
                style={{ color: 'var(--color-muted)' }}
              >
                {cd.direction}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
