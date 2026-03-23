'use client'

import { ImageIcon } from 'lucide-react'
import type { WebAppDNA } from '@/types/dna'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

const roleDescriptions: Record<string, string> = {
  'hero-driven': 'Images lead the design — full-bleed, prominent, atmospheric',
  'supporting': 'Images complement the UI — visible but not dominant',
  'decorative': 'Images as texture or accent — backgrounds, patterns, subtle',
  'minimal': 'Interface-first — little to no imagery',
}

const overlayDescriptions: Record<string, string> = {
  'dark-scrim': 'Dark overlay for text readability',
  'gradient-fade': 'Gradient transition from image to content',
  'clear-space': 'Text placed in image-free areas',
  'knockout': 'Text cut out / reversed over images',
  'none': 'No text-over-image pattern',
}

interface ImageTreatmentFieldProps {
  imageTreatment: WebAppDNA['image_treatment']
}

export function ImageTreatmentField({ imageTreatment }: ImageTreatmentFieldProps) {
  if (!imageTreatment) return null

  return (
    <div>
      <SectionLabel>Image Direction</SectionLabel>
      <div className="flex flex-col gap-2">
        {/* Role indicator */}
        <div
          className="flex items-center gap-2 p-2 rounded-md"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <ImageIcon
            size={14}
            className="shrink-0"
            style={{ color: 'var(--color-accent)' }}
          />
          <div>
            <div className="text-[12px] font-medium capitalize" style={{ color: 'var(--color-text)' }}>
              {imageTreatment.role.replace('-', ' ')}
            </div>
            <div className="text-[10px] leading-snug" style={{ color: 'var(--color-muted)' }}>
              {roleDescriptions[imageTreatment.role] || ''}
            </div>
          </div>
        </div>

        {/* Treatment tags */}
        {imageTreatment.treatment.length > 0 && (
          <div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--color-muted)' }}>Treatment</div>
            <div className="flex flex-wrap gap-1">
              {imageTreatment.treatment.map((t, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Placement tags */}
        {imageTreatment.placement.length > 0 && (
          <div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--color-muted)' }}>Placement</div>
            <div className="flex flex-wrap gap-1">
              {imageTreatment.placement.map((p, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Text overlay */}
        {imageTreatment.text_overlay && imageTreatment.text_overlay !== 'none' && (
          <div className="text-[11px] leading-snug" style={{ color: 'var(--color-muted)' }}>
            <span style={{ color: 'var(--color-text)' }}>Text overlay:</span>{' '}
            {overlayDescriptions[imageTreatment.text_overlay] || imageTreatment.text_overlay}
          </div>
        )}
      </div>
    </div>
  )
}
