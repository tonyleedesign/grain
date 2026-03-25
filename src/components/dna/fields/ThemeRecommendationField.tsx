'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Palette } from 'lucide-react'
import type { WebAppDNA } from '@/types/dna'

interface ThemeRecommendationFieldProps {
  themeRecommendation: NonNullable<WebAppDNA['theme_recommendation']>
}

export function ThemeRecommendationField({ themeRecommendation }: ThemeRecommendationFieldProps) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 mb-2 cursor-pointer"
        style={{ color: 'var(--color-text)' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Palette size={14} style={{ color: 'var(--color-muted)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Theme</span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 pl-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-bg)',
              }}
            >
              {themeRecommendation.library}
            </span>
            {themeRecommendation.theme_preset && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {themeRecommendation.theme_preset}
              </span>
            )}
          </div>
          <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
            {themeRecommendation.rationale}
          </div>
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Components</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {themeRecommendation.component_notes}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
