'use client'

// AI Export tab — generates a skill.md behavioral contract for LLMs.
// The export is designed to prevent generic "AI slop" by combining
// personalized DNA tokens with hardcoded anti-pattern rules.

import { useState } from 'react'
import { Copy, Check, FileText, Sparkles } from 'lucide-react'
import type { Medium, WebAppDNA, ImageGenDNA } from '@/types/dna'
import { formatForCodeTools, formatForMidjourney } from '@/lib/export-formatters'
import { FeedbackPrompt } from './FeedbackPrompt'

type ExportFormat = 'skill' | 'midjourney'

interface ExportViewProps {
  medium: Medium
  dna: WebAppDNA | ImageGenDNA
  useCase: string
  boardId: string | null
}

export function ExportView({ medium, dna, useCase, boardId }: ExportViewProps) {
  const [format, setFormat] = useState<ExportFormat>('skill')
  const [copied, setCopied] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  const output =
    format === 'skill'
      ? formatForCodeTools(dna, medium, useCase || undefined)
      : medium === 'image'
        ? formatForMidjourney(dna as ImageGenDNA, useCase || undefined)
        : formatForCodeTools(dna, medium, useCase || undefined)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setShowFeedback(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Sparkles size={12} style={{ color: 'var(--color-accent)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>
          {format === 'skill' ? 'Design Skill — paste into any AI tool' : 'Midjourney Prompt'}
        </span>
      </div>

      {/* Format toggle */}
      <div className="flex gap-1 p-0.5 rounded-md" style={{ backgroundColor: 'var(--color-bg)' }}>
        <FormatButton
          active={format === 'skill'}
          onClick={() => setFormat('skill')}
          icon={<FileText size={11} />}
        >
          Skill.md
        </FormatButton>
        {medium === 'image' && (
          <FormatButton
            active={format === 'midjourney'}
            onClick={() => setFormat('midjourney')}
            icon={<Sparkles size={11} />}
          >
            Midjourney
          </FormatButton>
        )}
      </div>

      {/* Usage hint */}
      <div
        className="text-[10px] px-2 py-1.5 rounded-md leading-relaxed"
        style={{
          color: 'var(--color-muted)',
          backgroundColor: 'var(--color-bg)',
          border: '1px dashed var(--color-border)',
        }}
      >
        {format === 'skill'
          ? 'Copy this into Claude, ChatGPT, Cursor, or any AI coding tool as a system prompt or skill file. It tells the AI exactly how to build your design — not generic, not templated.'
          : 'Paste directly into Midjourney. Anti-patterns are converted to --no flags.'}
      </div>

      {/* Output */}
      <div className="relative">
        <pre
          className="text-[11px] leading-relaxed p-3 rounded-md overflow-x-auto whitespace-pre-wrap"
          style={{
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            fontFamily: 'monospace',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {output}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-[11px]"
          style={{
            backgroundColor: copied ? 'var(--color-accent)' : 'var(--color-surface)',
            border: `1px solid ${copied ? 'var(--color-accent)' : 'var(--color-border)'}`,
            color: copied ? '#fff' : 'var(--color-muted)',
            transition: 'all 150ms ease',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Feedback prompt — appears after copy */}
      {showFeedback && <FeedbackPrompt boardId={boardId} />}
    </div>
  )
}

function FormatButton({
  children,
  active,
  onClick,
  icon,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 text-[12px] py-1.5 rounded-md cursor-pointer transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-surface)' : 'transparent',
        color: active ? 'var(--color-text)' : 'var(--color-muted)',
        border: 'none',
        fontFamily: 'var(--font-family)',
        fontWeight: active ? 500 : 400,
      }}
    >
      {icon}
      {children}
    </button>
  )
}
