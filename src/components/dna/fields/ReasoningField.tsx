'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, Brain } from 'lucide-react'
import type { DNAReasoning } from '@/types/dna'

interface ReasoningFieldProps {
  reasoning: DNAReasoning
}

export function ReasoningField({ reasoning }: ReasoningFieldProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left cursor-pointer mb-1.5"
        style={{ background: 'none', border: 'none', padding: 0 }}
      >
        {expanded ? (
          <ChevronDown size={12} style={{ color: 'var(--color-muted)' }} />
        ) : (
          <ChevronRight size={12} style={{ color: 'var(--color-muted)' }} />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
          AI Reasoning
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3">
          {/* Observation layer — what was seen */}
          <div
            className="rounded-md p-3"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Eye size={12} style={{ color: 'var(--color-muted)' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                What the AI Saw
              </span>
            </div>

            {reasoning.per_image.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
                  Per Image
                </div>
                <ol className="list-decimal list-inside flex flex-col gap-1">
                  {reasoning.per_image.map((obs, i) => (
                    <li key={i} className="text-[12px] leading-snug" style={{ color: 'var(--color-text)' }}>
                      {obs}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {reasoning.repeated_signals && (
              <div className="mb-2">
                <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
                  Repeated Signals
                </div>
                <p className="text-[12px] leading-snug" style={{ color: 'var(--color-text)' }}>
                  {reasoning.repeated_signals}
                </p>
              </div>
            )}

            {reasoning.tensions && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
                  Tensions
                </div>
                <p className="text-[12px] leading-snug" style={{ color: 'var(--color-text)' }}>
                  {reasoning.tensions}
                </p>
              </div>
            )}
          </div>

          {/* Conclusion layer — what was decided */}
          <div
            className="rounded-md p-3"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Brain size={12} style={{ color: 'var(--color-muted)' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                What the AI Decided
              </span>
            </div>

            {reasoning.synthesis && (
              <div className="mb-2">
                <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
                  Synthesis
                </div>
                <p className="text-[12px] leading-snug" style={{ color: 'var(--color-text)' }}>
                  {reasoning.synthesis}
                </p>
              </div>
            )}

            {reasoning.archetype_check && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
                  Archetype Check
                </div>
                <p className="text-[12px] leading-snug" style={{ color: 'var(--color-text)' }}>
                  {reasoning.archetype_check}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
