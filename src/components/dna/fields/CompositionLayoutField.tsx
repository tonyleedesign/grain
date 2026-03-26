'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react'
import type { WebAppDNA } from '@/types/dna'

interface CompositionLayoutFieldProps {
  compositionLayout: NonNullable<WebAppDNA['composition_layout']>
}

export function CompositionLayoutField({ compositionLayout }: CompositionLayoutFieldProps) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 mb-2 cursor-pointer"
        style={{ color: 'var(--color-text)' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <LayoutGrid size={14} style={{ color: 'var(--color-muted)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Composition & Layout</span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2.5 pl-1">
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Archetype</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {compositionLayout.page_archetype}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Structure</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {compositionLayout.structure}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Spatial Rules</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {compositionLayout.spatial_rules}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Responsive</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {compositionLayout.responsive_notes}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
