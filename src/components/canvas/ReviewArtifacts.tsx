'use client'

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import type { OrganizeArtifactPreview } from '@/types/organize'

export function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function ArtifactTile({ artifact }: { artifact: OrganizeArtifactPreview }) {
  const previewUrl = artifact.kind === 'image' ? artifact.url : artifact.previewUrl

  if (previewUrl) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg)',
          backgroundImage: `url("${previewUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '1px solid var(--color-border)',
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {artifact.kind}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.3 }}>
        {artifact.title || artifact.url || 'Untitled link'}
      </div>
    </div>
  )
}

export function ArtifactMosaic({
  artifacts,
  maxArtifacts = 4,
}: {
  artifacts: OrganizeArtifactPreview[]
  maxArtifacts?: number
}) {
  const previewArtifacts = artifacts.slice(0, maxArtifacts)
  const hiddenArtifactCount = Math.max(0, artifacts.length - previewArtifacts.length)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
      }}
    >
      {previewArtifacts.map((artifact) => (
        <ArtifactTile key={artifact.id} artifact={artifact} />
      ))}
      {hiddenArtifactCount > 0 && (
        <div
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'color-mix(in srgb, var(--color-text) 5%, var(--color-surface))',
            border: '1px dashed var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-muted)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          +{hiddenArtifactCount} more
        </div>
      )}
    </div>
  )
}

export function SelectableReviewCard({
  checked,
  onToggle,
  title,
  subtitle,
  reason,
  mosaic,
  badgeLabel,
  floatingAction,
}: {
  checked: boolean
  onToggle: (checked: boolean) => void
  title: string
  subtitle: string
  reason?: ReactNode
  mosaic: ReactNode
  badgeLabel?: string
  floatingAction?: ReactNode
}) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderRadius: 'var(--radius-xl)',
        backgroundColor: checked
          ? 'var(--color-surface)'
          : 'color-mix(in srgb, var(--color-bg) 82%, white 18%)',
        border: `1.5px solid ${checked ? 'var(--color-accent)' : 'var(--color-border)'}`,
        boxShadow: checked ? 'var(--shadow-card)' : 'none',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.35, overflow: 'hidden' }}>
            {badgeLabel ? (
              <Badge
                variant="destructive"
                className="mr-2 inline-flex h-5 rounded-full border border-[color-mix(in_srgb,var(--destructive)_18%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_12%,var(--color-surface))] px-2 align-middle text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--destructive)]"
              >
                {badgeLabel}
              </Badge>
            ) : null}
            <span
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                verticalAlign: 'top',
              }}
            >
              {title}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{subtitle}</div>
        </div>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          style={{
            width: 16,
            height: 16,
            accentColor: 'var(--color-accent)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />
      </div>

      {mosaic}

      {reason ? (
        <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--color-muted)' }}>{reason}</div>
      ) : null}

      {floatingAction ? (
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
          }}
        >
          {floatingAction}
        </div>
      ) : null}
    </label>
  )
}
