'use client'

import { cn } from '@/lib/utils'
import type { WebAppDNA } from '@/types/dna'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

const LEVELS = ['static', 'subtle', 'expressive', 'immersive'] as const

const levelDescriptions: Record<string, string> = {
  'static': 'No animation — content loads in place',
  'subtle': 'Fade-ins, gentle hovers, micro-interactions',
  'expressive': 'Scroll sequences, staggered reveals, transitions',
  'immersive': '3D scenes, shaders, canvas-based visuals',
}

const approachLabels: Record<string, string> = {
  'css-only': 'CSS Only',
  'framer-motion': 'Framer Motion',
  'gsap': 'GSAP',
  'webgl/three.js': 'WebGL / Three.js',
}

interface MotionFieldProps {
  motion: WebAppDNA['motion']
}

export function MotionField({ motion }: MotionFieldProps) {
  if (!motion) return null

  const activeIndex = LEVELS.indexOf(motion.level)

  return (
    <div>
      <SectionLabel>Motion</SectionLabel>
      <div className="flex flex-col gap-2">
        {/* Level meter */}
        <div>
          <div className="flex items-center gap-1">
            {LEVELS.map((l, i) => (
              <div
                key={l}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  i <= activeIndex
                    ? 'bg-[var(--color-text)]'
                    : 'bg-[var(--color-border)]'
                )}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between items-baseline">
            <div className="text-[11px] capitalize" style={{ color: 'var(--color-text)' }}>
              {motion.level}
            </div>
            <div
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-border)',
              }}
            >
              {approachLabels[motion.approach] || motion.approach}
            </div>
          </div>
          <div className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {levelDescriptions[motion.level] || ''}
          </div>
        </div>

        {/* Technique tags */}
        {motion.techniques.length > 0 && (
          <div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--color-muted)' }}>Techniques</div>
            <div className="flex flex-wrap gap-1">
              {motion.techniques.map((t, i) => (
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
      </div>
    </div>
  )
}
