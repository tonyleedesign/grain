'use client'

import { Check, X } from 'lucide-react'
import type { AntiPattern } from '@/types/dna'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

interface AntiPatternsFieldProps {
  antiPatterns: AntiPattern[]
}

export function AntiPatternsField({ antiPatterns }: AntiPatternsFieldProps) {
  if (!antiPatterns.length) return null

  return (
    <div>
      <SectionLabel>This, Not That</SectionLabel>
      <div className="flex flex-col gap-2">
        {antiPatterns.map((ap, i) => (
          <div
            key={i}
            className="rounded-md p-2"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <div className="flex items-start gap-1.5 mb-1">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#4a7c4f' }} />
              <span className="text-[12px] leading-snug" style={{ color: 'var(--color-text)' }}>
                {ap.this_is}
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <X className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#b44040' }} />
              <span className="text-[12px] leading-snug" style={{ color: 'var(--color-muted)' }}>
                {ap.not_that}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
