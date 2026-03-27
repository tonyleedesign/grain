'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { APP_NAME } from '@/config/app'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) {
      router.replace('/canvas')
    }
  }, [loading, router, user])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !password) return

    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setSubmitting(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    router.replace('/canvas')
  }

  return (
    <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div
        className="w-full max-w-sm p-8"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-panel)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h1 className="mb-2 text-center text-xl font-medium" style={{ color: 'var(--color-text)' }}>
          {APP_NAME}
        </h1>
        <p className="mb-6 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
          Sign in to access your private canvas.
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              fontFamily: 'var(--font-family)',
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              fontFamily: 'var(--font-family)',
            }}
          />

          {error && (
            <p className="text-sm" style={{ color: 'var(--destructive)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="py-2 text-sm"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              fontFamily: 'var(--font-family)',
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
