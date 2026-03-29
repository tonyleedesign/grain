'use client'

// Medium picker — shown before DNA extraction to select web/app or image gen.

import { useState } from 'react'
import { Monitor, ImageIcon } from 'lucide-react'
import { Medium } from '@/types/dna'

const MEDIUMS: { id: Medium; label: string; icon: typeof Monitor; description: string }[] = [
  { id: 'web', label: 'Web / App', icon: Monitor, description: 'Design tokens for interfaces' },
  { id: 'image', label: 'Image Gen', icon: ImageIcon, description: 'Parameters for AI image tools' },
]

interface MediumPickerProps {
  onSubmit: (medium: Medium, useCase: string, sourceContext?: string, appealContext?: string) => void
  artifactCount: number
  analyzableVisualCount: number
}

export function MediumPicker({ onSubmit, artifactCount, analyzableVisualCount }: MediumPickerProps) {
  const [selected, setSelected] = useState<Medium | null>(null)
  const [useCase, setUseCase] = useState('')
  const [sourceContext, setSourceContext] = useState('')
  const [appealContext, setAppealContext] = useState('')
  const canExtract = Boolean(selected && useCase.trim() && analyzableVisualCount > 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-[13px] mb-1" style={{ color: 'var(--color-text)' }}>
          What are you designing for?
        </p>
        <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
          {artifactCount} item{artifactCount !== 1 ? 's' : ''} in this board
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--color-muted)' }}>
          {analyzableVisualCount > 0
            ? `${analyzableVisualCount} analyzable visual${analyzableVisualCount !== 1 ? 's' : ''} available for extraction`
            : 'This board has no preview images to observe yet. Add images, or use links with preview images.'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {MEDIUMS.map(({ id, label, icon: Icon, description }) => (
          <button
            key={id}
            onClick={() => setSelected(id)}
            className="flex items-center gap-3 p-3 rounded-lg text-left cursor-pointer transition-colors"
            style={{
              border: `1.5px solid ${selected === id ? 'var(--color-accent)' : 'var(--color-border)'}`,
              backgroundColor: selected === id ? 'var(--color-bg)' : 'var(--color-surface)',
            }}
          >
            <Icon size={18} style={{ color: selected === id ? 'var(--color-accent)' : 'var(--color-muted)' }} />
            <div>
              <div className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>
                {label}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                {description}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div>
        <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--color-text)' }}>
          What are you building?
        </label>
        <p className="text-[10px] mb-1.5" style={{ color: 'var(--color-muted)' }}>
          This shapes the entire DNA — typography, colors, layout, and anti-patterns will be tailored to your use case.
        </p>
        <textarea
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          placeholder="e.g. Portfolio site for a photographer, SaaS dashboard for analytics, Landing page for a music school..."
          rows={2}
          className="w-full text-[13px] p-2 resize-none rounded-md"
          style={{
            border: `1px solid ${useCase.trim() ? 'var(--color-border)' : 'var(--color-accent)'}`,
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-family)',
          }}
        />
      </div>

      <div>
        <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--color-text)' }}>
          What draws you to these images?
        </label>
        <p className="text-[10px] mb-1.5" style={{ color: 'var(--color-muted)' }}>
          Tell us what you like — the mood, colors, texture, composition, feeling. Helps the AI focus on what matters to you.
        </p>
        <textarea
          value={appealContext}
          onChange={(e) => setAppealContext(e.target.value)}
          placeholder="e.g. the motion blur and neon glow, the moody urban atmosphere, the cinematic framing and muted tones"
          rows={2}
          className="w-full text-[13px] p-2 resize-none rounded-md"
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-family)',
          }}
        />
      </div>

      <div>
        <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--color-text)' }}>
          Reference context
        </label>
        <p className="text-[10px] mb-1.5" style={{ color: 'var(--color-muted)' }}>
          Where are these images from? Helps the AI extract more accurately.
        </p>
        <input
          type="text"
          value={sourceContext}
          onChange={(e) => setSourceContext(e.target.value)}
          placeholder="e.g. movie name, art style, photographer, time period"
          className="w-full text-[13px] p-2 rounded-md"
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-family)',
          }}
        />
      </div>

      <button
        disabled={!canExtract}
        onClick={() => selected && onSubmit(selected, useCase, sourceContext.trim() || undefined, appealContext.trim() || undefined)}
        className="w-full py-2.5 text-[13px] font-medium rounded-md cursor-pointer transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-surface)',
          border: 'none',
        }}
      >
        Extract DNA
      </button>
    </div>
  )
}
