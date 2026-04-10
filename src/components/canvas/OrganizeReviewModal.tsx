'use client'

import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { OrganizeArtifactPreview, OrganizePlanBoardPreview } from '@/types/organize'
import { Button } from '@/components/ui/button'
import { ArtifactMosaic, SelectableReviewCard, toTitleCase } from './ReviewArtifacts'
import { useIsNarrowViewport } from './useIsNarrowViewport'

interface OrganizeReviewModalProps {
  open: boolean
  proposals: OrganizePlanBoardPreview[]
  selectedIds: string[]
  isApplying?: boolean
  onSelectionChange: (selectedIds: string[]) => void
  onApply: (selectedIds: string[]) => void
  onReject: () => void
  onClose: () => void
}

function ProposalCard({
  proposal,
  checked,
  onToggle,
}: {
  proposal: OrganizePlanBoardPreview
  checked: boolean
  onToggle: (checked: boolean) => void
}) {
  return (
    <SelectableReviewCard
      checked={checked}
      onToggle={onToggle}
      title={toTitleCase(proposal.board_name)}
      subtitle={`${proposal.artifacts.length} artifact${proposal.artifacts.length === 1 ? '' : 's'}`}
      reason={proposal.reason}
      mosaic={<ArtifactMosaic artifacts={proposal.artifacts as OrganizeArtifactPreview[]} />}
    />
  )
}

export function OrganizeReviewModal({
  open,
  proposals,
  selectedIds,
  isApplying = false,
  onSelectionChange,
  onApply,
  onReject,
  onClose,
}: OrganizeReviewModalProps) {
  const isMobile = useIsNarrowViewport()
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        backgroundColor: 'color-mix(in srgb, var(--color-text) 42%, transparent)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: isMobile ? '100vw' : 'min(980px, calc(100vw - 48px))',
          maxHeight: isMobile ? '100vh' : 'min(84vh, 920px)',
          height: isMobile ? '100vh' : 'auto',
          borderRadius: isMobile ? 0 : 'var(--radius-xl)',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-panel)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            padding: isMobile ? 16 : 24,
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
              Review proposed boards
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', maxWidth: 680 }}>
              Check the boards you want to create. Unchecked proposals will be skipped and nothing moves until you apply.
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="outline"
            size="icon-sm"
            className="rounded-full text-[var(--color-muted)] bg-[var(--color-bg)]"
            aria-label="Close organize review"
          >
            <X size={14} />
          </Button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              onClick={() => onSelectionChange(proposals.map((proposal) => proposal.id))}
              variant="outline"
              size="sm"
              className="rounded-full bg-[var(--color-bg)]"
            >
              Select all
            </Button>
            <Button
              onClick={() => onSelectionChange([])}
              variant="outline"
              size="sm"
              className="rounded-full bg-[var(--color-bg)]"
            >
              Clear all
            </Button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', alignSelf: isMobile ? 'flex-start' : 'auto' }}>
            {selectedIds.length} of {proposals.length} selected
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              checked={selectedSet.has(proposal.id)}
              onToggle={(checked) => {
                if (checked) {
                  onSelectionChange(
                    selectedIds.includes(proposal.id) ? selectedIds : [...selectedIds, proposal.id]
                  )
                  return
                }

                onSelectionChange(selectedIds.filter((id) => id !== proposal.id))
              }}
            />
          ))}
        </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr auto',
            alignItems: isMobile ? 'stretch' : 'center',
            columnGap: 16,
            rowGap: isMobile ? 12 : 0,
            padding: isMobile ? '16px' : '16px 24px 24px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            flexShrink: 0,
          }}
        >
          <Button
            onClick={onReject}
            disabled={isApplying}
            variant="link"
            size="sm"
            className="px-0 text-[var(--destructive)] hover:text-[color-mix(in_srgb,var(--destructive)_88%,black_12%)]"
            style={{
              justifySelf: isMobile ? 'stretch' : 'start',
              order: isMobile ? 3 : 1,
            }}
          >
            Reject this plan
          </Button>
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: 10,
              justifySelf: isMobile ? 'stretch' : 'end',
              order: isMobile ? 2 : 2,
            }}
          >
            <Button
              onClick={onClose}
              disabled={isApplying}
              variant="outline"
              size="lg"
              className="rounded-full bg-[var(--color-bg)]"
              style={{ order: isMobile ? 2 : 1 }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => onApply(selectedIds)}
              disabled={isApplying || selectedIds.length === 0}
              size="lg"
              className="rounded-full bg-[var(--color-accent)] text-[var(--color-surface)] hover:bg-[color-mix(in_srgb,var(--color-accent)_88%,black_12%)]"
              style={{ order: isMobile ? 1 : 2 }}
            >
              {isApplying ? 'Creating boards...' : 'Create selected boards'}
            </Button>
          </div>
        </div>
      </div>
    </div>
    ),
    document.body
  )
}
