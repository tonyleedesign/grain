'use client'

import type { PatternEvidence } from '@/types/dna'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

function regionHintToPosition(hint: string): string {
  const map: Record<string, string> = {
    center: 'center',
    'top-left': 'top left',
    'top-right': 'top right',
    'bottom-left': 'bottom left',
    'bottom-right': 'bottom right',
    top: 'top center',
    bottom: 'bottom center',
    left: 'center left',
    right: 'center right',
    background: 'center',
  }
  return map[hint] ?? 'center'
}

interface PatternEvidenceFieldProps {
  evidence: PatternEvidence[]
  imageUrls: string[]
}

export function PatternEvidenceField({
  evidence,
  imageUrls,
}: PatternEvidenceFieldProps) {
  if (!evidence.length || !imageUrls.length) return null

  return (
    <div>
      <SectionLabel>Evidence</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {evidence.map((ev, i) => {
          const url = imageUrls[ev.image_index]
          if (!url) return null

          return (
            <div
              key={i}
              className="rounded-md overflow-hidden h-full"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
            >
              <div className="w-full h-36 overflow-hidden">
                <img
                  src={url}
                  alt={ev.quality}
                  className="w-full h-full"
                  style={{
                    objectFit: 'cover',
                    objectPosition: regionHintToPosition(ev.region_hint),
                    transform: 'scale(1.4)',
                    transformOrigin: regionHintToPosition(ev.region_hint),
                  }}
                />
              </div>
              <div
                className="px-2 py-1.5"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-[10px] leading-tight" style={{ color: 'var(--color-muted)' }}>
                  {ev.quality}
                </span>
                {ev.conflict && (
                  <span className="block text-[9px] leading-tight mt-0.5" style={{ color: 'var(--color-accent)' }}>
                    ⚡ {ev.conflict}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
