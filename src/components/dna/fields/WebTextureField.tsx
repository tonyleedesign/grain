'use client'

import { Layers } from 'lucide-react'
import type { WebAppDNA } from '@/types/dna'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

interface WebTextureFieldProps {
  texture: WebAppDNA['texture']
}

export function WebTextureField({ texture }: WebTextureFieldProps) {
  if (!texture) return null

  return (
    <div>
      <SectionLabel>Texture & Surface</SectionLabel>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start gap-2 p-2 rounded-md" style={{ backgroundColor: 'var(--color-bg)' }}>
          <Layers size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
          <div className="flex flex-col gap-1.5">
            <div>
              <div className="text-[10px] font-medium" style={{ color: 'var(--color-text)' }}>Surface</div>
              <div className="text-[10px] leading-snug" style={{ color: 'var(--color-muted)' }}>
                {texture.surface_feel}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium" style={{ color: 'var(--color-text)' }}>Light & Depth</div>
              <div className="text-[10px] leading-snug" style={{ color: 'var(--color-muted)' }}>
                {texture.light_and_depth}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium" style={{ color: 'var(--color-text)' }}>Texture Strategy</div>
              <div className="text-[10px] leading-snug" style={{ color: 'var(--color-muted)' }}>
                {texture.texture_strategy}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
