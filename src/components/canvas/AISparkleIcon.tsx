'use client'

// Consistent AI sparkle icon used across all canvas AI features.
// Green outline style — used in context menu, image toolbar, selection toolbar, etc.

import { Sparkles } from 'lucide-react'

interface AISparkleIconProps {
  size?: number
}

export function AISparkleIcon({ size = 14 }: AISparkleIconProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Sparkles
        size={size}
        style={{
          color: 'var(--color-accent)',
          strokeWidth: 1.75,
        }}
      />
    </div>
  )
}
