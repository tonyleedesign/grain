'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GrainCanvasLoader } from '@/components/canvas/GrainCanvasLoader'
import { useAuth } from '@/context/AuthContext'

export function PrivateCanvasClient() {
  const router = useRouter()
  const { session, user, loading, signOut } = useAuth()
  const [canvasId, setCanvasId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!session || !user) {
      router.replace('/login')
      return
    }

    let aborted = false

    const loadCanvas = async () => {
      try {
        const res = await fetch('/api/auth/private-canvas', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load private canvas')
        }

        const data = await res.json()
        if (!aborted) {
          setCanvasId(data.canvasId)
          setError(null)
        }
      } catch (err) {
        if (!aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load private canvas')
        }
      }
    }

    loadCanvas()

    return () => {
      aborted = true
    }
  }, [loading, router, session, user])

  if (loading || (!canvasId && !error)) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-muted)' }}
      >
        Loading your canvas...
      </div>
    )
  }

  if (error || !canvasId) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg)', color: 'var(--destructive)' }}
      >
        {error || 'Private canvas unavailable'}
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen">
      <GrainCanvasLoader canvasType="private" canvasId={canvasId} uploadedBy={user?.email ?? user?.id ?? null} />
    </div>
  )
}
