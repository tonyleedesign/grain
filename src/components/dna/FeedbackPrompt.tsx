'use client'

// "Did this work?" inline prompt — appears after copying exported DNA.

import { useState } from 'react'

interface FeedbackPromptProps {
  boardId: string | null
}

export function FeedbackPrompt({ boardId }: FeedbackPromptProps) {
  const [state, setState] = useState<'ask' | 'input' | 'done'>('ask')
  const [whatWasOff, setWhatWasOff] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!boardId) return null

  const submitFeedback = async (rating: 'worked' | 'needs_tweaking') => {
    if (rating === 'worked') {
      setSubmitting(true)
      await fetch('/api/dna-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, rating }),
      }).catch(() => {})
      setState('done')
      setSubmitting(false)
      return
    }
    setState('input')
  }

  const submitTweakFeedback = async () => {
    setSubmitting(true)
    await fetch('/api/dna-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardId,
        rating: 'needs_tweaking',
        whatWasOff: whatWasOff || undefined,
      }),
    }).catch(() => {})
    setState('done')
    setSubmitting(false)
  }

  if (state === 'done') {
    return (
      <p className="text-[11px] mt-3" style={{ color: 'var(--color-muted)' }}>
        Thanks! Feedback saved for next regeneration.
      </p>
    )
  }

  if (state === 'input') {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <label className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
          What was off?
        </label>
        <input
          type="text"
          value={whatWasOff}
          onChange={(e) => setWhatWasOff(e.target.value)}
          placeholder="Colors too muted, Font was wrong, Too generic..."
          className="text-[12px] p-2 rounded-md w-full"
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
          }}
        />
        <button
          onClick={submitTweakFeedback}
          disabled={submitting}
          className="text-[12px] py-1.5 px-3 rounded-md cursor-pointer self-start"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-surface)',
            border: 'none',
          }}
        >
          {submitting ? 'Saving...' : 'Submit'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
        Did this work?
      </span>
      <button
        onClick={() => submitFeedback('worked')}
        disabled={submitting}
        className="text-[11px] py-1 px-2 rounded-md cursor-pointer"
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
        }}
      >
        Worked
      </button>
      <button
        onClick={() => submitFeedback('needs_tweaking')}
        disabled={submitting}
        className="text-[11px] py-1 px-2 rounded-md cursor-pointer"
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
        }}
      >
        Needs tweaking
      </button>
    </div>
  )
}
