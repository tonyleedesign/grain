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

const finishDescriptions: Record<string, string> = {
  'matte': 'Flat, non-reflective surfaces — paper, concrete, chalk',
  'glossy': 'Polished, reflective — glass-morphism, sheen, highlights',
  'frosted': 'Semi-transparent, blurred — backdrop-blur, frosted glass',
  'raw': 'Unpolished, textured — visible grain, rough edges, analog',
}

const lightBehaviorLabels: Record<string, string> = {
  'absorptive': 'Absorptive — no highlights, light dies on contact',
  'reflective': 'Reflective — specular highlights, gloss, glass',
  'mixed': 'Mixed — both matte and reflective surfaces present',
}

const shadowCrushLabels: Record<string, string> = {
  'none': 'Full shadow detail preserved',
  'moderate': 'Some crushed blacks, partial detail loss',
  'heavy': 'Deep blacks, shadows swallow detail',
}

const primaryTextureLabels: Record<string, string> = {
  'film-grain': 'Film grain',
  'halftone': 'Halftone print',
  'photocopy-noise': 'Photocopy noise',
  'scan-noise': 'Scan noise',
  'paper-fiber': 'Paper fiber',
  'asphalt-grit': 'Asphalt grit',
  'compression-artifacts': 'Compression artifacts',
  'none': 'None',
}

interface WebTextureFieldProps {
  texture: WebAppDNA['texture']
}

export function WebTextureField({ texture }: WebTextureFieldProps) {
  if (!texture) return null

  return (
    <div>
      <SectionLabel>Texture & Surface</SectionLabel>
      <div className="flex flex-col gap-2">
        {/* Finish indicator */}
        <div
          className="flex items-center gap-2 p-2 rounded-md"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <Layers
            size={14}
            className="shrink-0"
            style={{ color: 'var(--color-accent)' }}
          />
          <div>
            <div className="text-[12px] font-medium capitalize" style={{ color: 'var(--color-text)' }}>
              {texture.finish}
            </div>
            <div className="text-[10px] leading-snug" style={{ color: 'var(--color-muted)' }}>
              {finishDescriptions[texture.finish] || ''}
            </div>
          </div>
        </div>

        {/* Light behavior + shadow crush */}
        {(texture.light_behavior || texture.shadow_crush) && (
          <div className="flex flex-col gap-1">
            {texture.light_behavior && (
              <div className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                <span style={{ color: 'var(--color-text)' }}>Light: </span>
                {lightBehaviorLabels[texture.light_behavior] || texture.light_behavior}
              </div>
            )}
            {texture.shadow_crush && (
              <div className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                <span style={{ color: 'var(--color-text)' }}>Shadows: </span>
                {shadowCrushLabels[texture.shadow_crush] || texture.shadow_crush}
              </div>
            )}
          </div>
        )}

        {/* Background treatment tags */}
        {texture.background.length > 0 && (
          <div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--color-muted)' }}>Background</div>
            <div className="flex flex-wrap gap-1">
              {texture.background.map((bg, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {bg}
                </span>
              ))}
            </div>
          </div>
        )}

        {texture.primary_texture && texture.primary_texture.family !== 'none' && (
          <div className="flex flex-col gap-1">
            <div className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
              <span style={{ color: 'var(--color-text)' }}>Primary texture: </span>
              {primaryTextureLabels[texture.primary_texture.family] || texture.primary_texture.family}
              {` • ${texture.primary_texture.intensity} • ${texture.primary_texture.application}`}
            </div>
            <div className="text-[10px] leading-snug" style={{ color: 'var(--color-muted)' }}>
              {texture.primary_texture.rationale}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
