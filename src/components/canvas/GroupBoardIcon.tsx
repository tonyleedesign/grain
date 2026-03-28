'use client'

import { Layers } from 'lucide-react'

interface GroupBoardIconProps {
  size?: number
}

export function GroupBoardIcon({ size = 14 }: GroupBoardIconProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Layers
        size={size}
        style={{
          color: 'currentColor',
          strokeWidth: 1.75,
        }}
      />
    </div>
  )
}
