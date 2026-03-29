'use client'

import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Inbox, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ArtifactMosaic, SelectableReviewCard, toTitleCase } from './ReviewArtifacts'
import type { HoldingCellArtifact, HoldingCellBoardProposal, HoldingCellMode } from '@/types/holding-cell'

interface HoldingCellModalProps {
  open: boolean
  mode: HoldingCellMode
  captures: HoldingCellArtifact[]
  groupedBoards: HoldingCellBoardProposal[]
  newCaptureIds?: string[]
  selectedIds: string[]
  isGrouping?: boolean
  onSelectionChange: (selectedIds: string[]) => void
  onDeleteCapture: (captureId: string) => void
  onClose: () => void
  onGroup: () => void
  onRejectPlan: () => void
  onPlaceSelected: () => void
  footerNotice?: {
    text: string
    ctaLabel: string
    onClick: () => void
    animate?: boolean
  } | null
  footerSecondaryLink?: {
    label: string
    onClick: () => void
  } | null
}

function CaptureCard({
  artifact,
  isNew = false,
  checked,
  onToggle,
  onDelete,
}: {
  artifact: HoldingCellArtifact
  isNew?: boolean
  checked: boolean
  onToggle: (checked: boolean) => void
  onDelete: () => void
}) {
  return (
    <SelectableReviewCard
      checked={checked}
      onToggle={onToggle}
      title={artifact.title || artifact.siteName || artifact.url || 'Untitled capture'}
      subtitle={`${artifact.sourceChannel === 'telegram' ? 'Telegram' : 'Send to Grain'}${artifact.siteName ? ` / ${artifact.siteName}` : ''}`}
      mosaic={<ArtifactMosaic artifacts={[artifact]} maxArtifacts={1} />}
      badgeLabel={isNew ? 'New' : undefined}
      footerAction={
        <Button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDelete()
          }}
          aria-label="Delete capture"
          variant="ghost"
          size="icon-sm"
          className="rounded-full border border-transparent bg-transparent text-[var(--destructive)] hover:border-[color-mix(in_srgb,var(--destructive)_18%,transparent)] hover:bg-[color-mix(in_srgb,var(--destructive)_10%,var(--color-surface))] hover:text-[var(--destructive)]"
        >
          <Trash2 size={13} />
        </Button>
      }
    />
  )
}

function BoardCard({
  board,
  checked,
  onToggle,
}: {
  board: HoldingCellBoardProposal
  checked: boolean
  onToggle: (checked: boolean) => void
}) {
  return (
    <SelectableReviewCard
      checked={checked}
      onToggle={onToggle}
      title={toTitleCase(board.board_name)}
      subtitle={`${board.artifacts.length} artifact${board.artifacts.length === 1 ? '' : 's'}`}
      reason={board.reason}
      mosaic={<ArtifactMosaic artifacts={board.artifacts} />}
    />
  )
}

export function HoldingCellModal({
  open,
  mode,
  captures,
  groupedBoards,
  newCaptureIds = [],
  selectedIds,
  isGrouping = false,
  onSelectionChange,
  onDeleteCapture,
  onClose,
  onGroup,
  onRejectPlan,
  onPlaceSelected,
  footerNotice = null,
  footerSecondaryLink = null,
}: HoldingCellModalProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const newCaptureIdSet = useMemo(() => new Set(newCaptureIds), [newCaptureIds])
  const canGroup = mode === 'review' && selectedIds.length >= 2
  const reviewCards = mode === 'group-review'
    ? [
        ...groupedBoards.map((board) => ({ id: `board:${board.id}`, type: 'board' as const, board })),
        ...captures.map((artifact) => ({ id: artifact.id, type: 'capture' as const, artifact })),
      ]
    : captures.map((artifact) => ({ id: artifact.id, type: 'capture' as const, artifact }))

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1450,
        backgroundColor: 'color-mix(in srgb, var(--color-text) 42%, transparent)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(980px, calc(100vw - 48px))',
          maxHeight: 'min(84vh, 920px)',
          borderRadius: 'var(--radius-xl)',
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
            padding: 24,
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 6,
                  fontSize: 22,
                  fontWeight: 600,
                  color: 'var(--color-text)',
                }}
              >
                <Inbox size={18} />
                Holding cell
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', maxWidth: 680 }}>
                {mode === 'group-review'
                  ? 'Review the AI-formed boards and any leftover captures. Select what you want to place on the canvas.'
                  : 'Review incoming captures before placing them. You can place them directly or group them into boards with AI first.'}
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="icon-sm"
              className="rounded-full text-[var(--color-muted)] bg-[var(--color-bg)]"
              aria-label="Close holding cell"
            >
              <X size={14} />
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                onClick={() => onSelectionChange(reviewCards.map((item) => item.id))}
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
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              {selectedIds.length} of {reviewCards.length} selected
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 16,
            }}
          >
            {reviewCards.map((item) =>
              item.type === 'board' ? (
                <BoardCard
                  key={item.id}
                  board={item.board}
                  checked={selectedSet.has(item.id)}
                  onToggle={(checked) => {
                    if (checked) {
                      onSelectionChange(selectedIds.includes(item.id) ? selectedIds : [...selectedIds, item.id])
                    } else {
                      onSelectionChange(selectedIds.filter((id) => id !== item.id))
                    }
                  }}
                />
              ) : (
                <CaptureCard
                  key={item.id}
                  artifact={item.artifact}
                  isNew={newCaptureIdSet.has(item.artifact.id)}
                  checked={selectedSet.has(item.id)}
                  onDelete={() => onDeleteCapture(item.artifact.id)}
                  onToggle={(checked) => {
                    if (checked) {
                      onSelectionChange(selectedIds.includes(item.id) ? selectedIds : [...selectedIds, item.id])
                    } else {
                      onSelectionChange(selectedIds.filter((id) => id !== item.id))
                    }
                  }}
                />
              )
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            columnGap: 16,
            padding: '16px 24px 24px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            position: 'sticky',
            bottom: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'start' }}>
            {mode === 'group-review' ? (
              <Button
                onClick={onRejectPlan}
                variant="link"
                size="sm"
                className="px-0 text-[var(--destructive)] hover:text-[color-mix(in_srgb,var(--destructive)_88%,black_12%)]"
              >
                Reject this plan
              </Button>
            ) : (
              <Button
                onClick={onGroup}
                disabled={isGrouping || !canGroup}
                variant="outline"
                size="lg"
                className="rounded-full bg-[var(--color-bg)]"
              >
                {isGrouping ? (
                  <>
                    <Sparkles size={14} />
                    Grouping...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Group with AI
                  </>
                )}
              </Button>
            )}
          </div>

          <div style={{ justifySelf: 'center', minHeight: 28, display: 'flex', alignItems: 'center' }}>
            {footerNotice ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--color-muted)',
                  animation: footerNotice.animate
                    ? 'grain-holding-footer-notice-in 260ms cubic-bezier(0.22, 1, 0.36, 1)'
                    : undefined,
                }}
              >
                <span>{footerNotice.text}</span>
                <Button
                  onClick={footerNotice.onClick}
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-[var(--color-text)]"
                >
                  {footerNotice.ctaLabel}
                </Button>
              </div>
            ) : footerSecondaryLink ? (
              <Button
                onClick={footerSecondaryLink.onClick}
                variant="link"
                size="sm"
                className="h-auto px-0 text-[var(--color-text)]"
              >
                {footerSecondaryLink.label}
              </Button>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'end' }}>
            <Button
              onClick={onClose}
              variant="outline"
              size="lg"
              className="rounded-full bg-[var(--color-bg)]"
            >
              Close
            </Button>
            <Button
              onClick={onPlaceSelected}
              disabled={selectedIds.length === 0}
              size="lg"
              className="rounded-full bg-[var(--color-accent)] text-[var(--color-surface)] hover:bg-[color-mix(in_srgb,var(--color-accent)_88%,black_12%)]"
            >
              Place selected
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
