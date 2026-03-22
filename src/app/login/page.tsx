// Owner login page — linked subtly from community canvas top corner.
// Supabase Auth (email + password) for owner only.
// Reference: grain-prd.md Section 4, 12

import { APP_NAME } from '@/config/app'

export default function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div
        className="w-full max-w-sm p-8"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-panel)',
        }}
      >
        <h1
          className="mb-6 text-center text-xl font-medium"
          style={{ color: 'var(--color-text)' }}
        >
          {APP_NAME}
        </h1>
        <p
          className="text-center text-sm"
          style={{ color: 'var(--color-muted)' }}
        >
          Owner login — Supabase Auth coming soon.
        </p>
      </div>
    </div>
  )
}
