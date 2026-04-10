'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, useValue, TLShapeId } from 'tldraw'
import { supabase } from '@/lib/supabase'
import { useDNAPanel } from '@/hooks/useDNAPanel'
import { usePlacement } from '@/hooks/usePlacement'
import { useHoldingCell } from '@/hooks/useHoldingCell'
import { Inbox, RotateCcw, Sparkles, X } from 'lucide-react'
import { AIActionBar } from './AIActionBar'
import { GrainSelectionToolbar } from './GrainSelectionToolbar'
import { DNAPanelV2 } from '../dna/DNAPanelV2'
import { HoldingCellModal } from './HoldingCellModal'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/ThemeContext'
import { useBoardIdentity } from '@/hooks/useBoardIdentity'
import {
  buildPlacementPlan,
  enrichArtifactsWithNaturalDimensions,
} from '@/lib/capture-placement'
import type {
  PlacementPlan,
} from '@/types/holding-cell'
import type { CanvasCallbacks } from '@/types/canvas-callbacks'
import type React from 'react'

interface CanvasUIProps {
  canvasId: string
  accessToken?: string | null
  callbacksRef: React.MutableRefObject<CanvasCallbacks>
}

export function CanvasUI({ canvasId, accessToken, callbacksRef }: CanvasUIProps) {
  const editor = useEditor()
  const { isDefaultTheme, resetTheme } = useTheme()
  const dnaPanel = useDNAPanel()

  const getAuthHeadersForHooks = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? accessToken ?? null
    if (!token) return null
    return { Authorization: `Bearer ${token}` }
  }, [accessToken])

  useBoardIdentity(editor, canvasId, getAuthHeadersForHooks)
  const holdingCell = useHoldingCell(canvasId, accessToken)
  const [toolbarAI, setToolbarAI] = useState(false)
  const [toolbarAIAnchor, setToolbarAIAnchor] = useState<{ x: number; y: number } | null>(null)
  const [aiBarVisible, setAiBarVisible] = useState(false)
  const [clusterAnchor, setClusterAnchor] = useState<{ left: number; top: number } | null>(null)
  const [organizeReviewOpen, setOrganizeReviewOpen] = useState(false)
  const [organizeStatus, setOrganizeStatus] = useState<{ active: boolean; label: string }>({
    active: false,
    label: 'Organizing artifacts...',
  })

  const placement = usePlacement(editor, canvasId, {
    markCapturesApplied: holdingCell.markCapturesApplied,
    onPlacementFinalized: holdingCell.onPlacementComplete,
    onPlacementCancelled: holdingCell.exitPlacementMode,
    onOrganizePlacementFinished: (outcome) => {
      callbacksRef.current.onPlacementFinished?.(outcome)
    },
  }, getAuthHeadersForHooks)

  const clusterItems = useMemo(() => {
    const items: Array<
      | { id: string; type: 'button'; label: string; icon?: 'revert' | 'inbox'; onClick: () => void; highlight?: boolean }
      | { id: string; type: 'status'; label: string; icon?: 'sparkles' | 'inbox' }
    > = []

    if (!isDefaultTheme) {
      items.push({ id: 'revert-theme', type: 'button', label: 'Revert', icon: 'revert', onClick: resetTheme })
    }

    if (holdingCell.pendingCaptures.length > 0) {
      items.push({
        id: 'holding-cell',
        type: 'button',
        label: holdingCell.pendingCaptures.length === 1 ? '1 pending capture' : `${holdingCell.pendingCaptures.length} pending captures`,
        icon: 'inbox',
        onClick: holdingCell.openHoldingCell,
        highlight: holdingCell.newCapturesForReviewIds.length > 0,
      })
    }

    if (organizeStatus.active) {
      items.push({ id: 'organize-status', type: 'status', label: organizeStatus.label, icon: 'sparkles' })
    }

    if (placement.placementPlan) {
      items.push({ id: 'placement-status', type: 'status', label: 'Click to place / Esc to cancel', icon: 'inbox' })
    }

    return items
  }, [isDefaultTheme, organizeStatus.active, organizeStatus.label, holdingCell.pendingCaptures.length, holdingCell.newCapturesForReviewIds.length, holdingCell.openHoldingCell, placement.placementPlan, resetTheme])

  const updateClusterAnchor = useCallback(() => {
    const button = document.querySelector('.grain-organize-toolbar-button') as HTMLElement | null
    if (!button) {
      setClusterAnchor(null)
      return
    }
    const rect = button.getBoundingClientRect()
    setClusterAnchor({ left: rect.left + rect.width / 2, top: rect.top - 8 })
  }, [])

  const handleAskAI = useCallback(() => {
    setToolbarAIAnchor(null)
    setToolbarAI(true)
  }, [])

  const handleBeginPlacement = useCallback(async () => {
    const { boards, artifacts } = holdingCell.getSelection()
    if (boards.length === 0 && artifacts.length === 0) return
    const [enrichedArtifacts, enrichedBoards] = await Promise.all([
      enrichArtifactsWithNaturalDimensions(artifacts),
      Promise.all(
        boards.map(async (board) => ({
          ...board,
          artifacts: await enrichArtifactsWithNaturalDimensions(board.artifacts),
        }))
      ),
    ])
    placement.startPlacement(buildPlacementPlan({ artifacts: enrichedArtifacts, boards: enrichedBoards }), 'holding-cell')
    holdingCell.enterPlacementMode()
  }, [holdingCell, placement])

  // Register CanvasUI's handlers into the shared callbacksRef so tldraw's factory
  // components (GrainToolbar, GrainImageToolbar, GrainContextMenu) can call them
  // directly instead of via DOM custom events.
  // Note: onPlacementFinished is intentionally NOT registered here — it flows the
  // other direction (CanvasUI → GrainToolbar) and is registered by OrganizeToolbarButton.
  // Note: placement.startPlacement has an empty useCallback dep array so it's stable
  // for the lifetime of the component — this effect runs only once on mount.
  useEffect(() => {
    const ref = callbacksRef.current
    ref.onAskAI = (anchor) => {
      setToolbarAIAnchor(anchor || null)
      setToolbarAI(true)
    }
    ref.onOrganizeStatusChange = (active, label) => {
      setOrganizeStatus({ active, label: label || 'Organizing artifacts...' })
    }
    ref.onOrganizeReviewOpenChange = (open) => {
      setOrganizeReviewOpen(open)
    }
    ref.onStartPlacement = (plan, boards) => {
      placement.startPlacement(plan, 'organize', boards)
    }

    return () => {
      ref.onAskAI = null
      ref.onOrganizeStatusChange = null
      ref.onOrganizeReviewOpenChange = null
      ref.onStartPlacement = null
    }
  }, [callbacksRef, placement.startPlacement])

  useEffect(() => {
    if (clusterItems.length === 0) {
      setClusterAnchor(null)
      return
    }

    let frame = 0
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(updateClusterAnchor)
    }

    scheduleUpdate()
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [clusterItems.length, updateClusterAnchor])


  return (
    <>
      {!aiBarVisible && <GrainSelectionToolbar canvasId={canvasId} onAskAI={handleAskAI} />}
      <AIActionBar
        canvasId={canvasId}
        onExtractDna={dnaPanel.handleExtractDna}
        forceExpanded={toolbarAI}
        forceAnchor={toolbarAIAnchor}
        onForceExpandedConsumed={() => {
          setToolbarAI(false)
        }}
        onVisibilityChange={setAiBarVisible}
      />

      {clusterItems.length > 0 && clusterAnchor && !holdingCell.holdingOpen && !organizeReviewOpen ? (
        <PillCluster anchor={clusterAnchor} items={clusterItems} />
      ) : null}

      <BoardProcessingOverlay frameShapeId={dnaPanel.activeBoard?.frameShapeId ?? null} active={dnaPanel.dnaExtracting} label="Extracting DNA..." />

      {dnaPanel.boardToRender ? (
        <DNAPanelV2
          boardName={dnaPanel.boardToRender}
          boardId={dnaPanel.activeBoard?.boardId}
          frameShapeId={dnaPanel.activeBoard?.frameShapeId}
          canvasId={canvasId}
          isOpen={dnaPanel.panelVisible}
          onClose={dnaPanel.closePanel}
          onExtractionStateChange={dnaPanel.setDnaExtracting}
          accessToken={accessToken}
        />
      ) : null}

      <HoldingCellModal
        open={holdingCell.holdingOpen && holdingCell.pendingCaptures.length > 0}
        mode={holdingCell.holdingMode === 'placement' ? (holdingCell.groupedBoards.length > 0 ? 'group-review' : 'review') : holdingCell.holdingMode}
        captures={holdingCell.holdingMode === 'group-review'
          ? holdingCell.holdingArtifacts.filter((artifact) => holdingCell.groupReviewCaptureIdSet.has(artifact.id) && !holdingCell.groupedArtifactIds.has(artifact.id))
          : holdingCell.holdingArtifacts}
        groupedBoards={holdingCell.groupedBoards}
        newCaptureIds={holdingCell.sessionNewCaptureIds}
        selectedIds={holdingCell.holdingSelectedIds}
        isGrouping={holdingCell.isGroupingHolding}
        onSelectionChange={holdingCell.handleSelectionChange}
        onDeleteCapture={(captureId) => {
          void holdingCell.deletePendingCapture(captureId)
        }}
        onClose={holdingCell.closeHoldingCell}
        onGroup={holdingCell.handleGroup}
        onRejectPlan={holdingCell.handleRejectPlan}
        onPlaceSelected={handleBeginPlacement}
        footerNotice={holdingCell.holdingMode === 'group-review' && holdingCell.newCapturesForReviewIds.length > 0 ? {
          text: holdingCell.footerNoticeText,
          ctaLabel: 'Review them',
          onClick: holdingCell.handleFooterReviewNewCaptures,
          animate: true,
        } : null}
        footerSecondaryLink={holdingCell.holdingMode === 'review' && holdingCell.hasGroupedSnapshot ? {
          label: 'Back to grouped plan',
          onClick: holdingCell.handleBackToGroupedPlan,
        } : null}
      />

      <PlacementPreviewOverlay active={Boolean(placement.placementPlan)} plan={placement.placementPlan} />

      <PlacementDecisionModal
        open={Boolean(placement.placementOverlapFrameId && placement.placementPendingAnchor)}
        title="Place inside this board?"
        description="Clicking Continue will place all selected captures inside the target board frame."
        confirmLabel="Continue"
        onClose={placement.dismissOverlapPrompt}
        onConfirm={placement.confirmOverlapPlacement}
      />

      <PlacementDecisionModal
        open={Boolean(placement.placementError)}
        title="Placement blocked"
        description={placement.placementError || ''}
        confirmLabel="Okay"
        hideCancel
        onClose={placement.dismissError}
        onConfirm={placement.dismissError}
      />
    </>
  )
}

function PillCluster({
  anchor,
  items,
}: {
  anchor: { left: number; top: number }
  items: Array<
    | { id: string; type: 'button'; label: string; icon?: 'revert' | 'inbox'; onClick: () => void; highlight?: boolean }
    | { id: string; type: 'status'; label: string; icon?: 'sparkles' | 'inbox' }
  >
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: anchor.left,
        top: anchor.top,
        transform: 'translate(-50%, -100%)',
        zIndex: 1600,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {items.map((item) =>
        item.type === 'button' ? (
          <button
            key={item.id}
            onClick={item.onClick}
            style={{
              ...pillStyle,
              animation: item.highlight ? 'grain-pending-pill-shimmer 1.7s ease-in-out infinite' : undefined,
              boxShadow: item.highlight
                ? '0 0 0 1px color-mix(in srgb, var(--color-accent) 22%, transparent), var(--shadow-soft)'
                : pillStyle.boxShadow,
            }}
          >
            {item.icon === 'revert' ? <RotateCcw size={12} /> : <Inbox size={13} />}
            {item.label}
          </button>
        ) : (
          <div key={item.id} style={{ ...pillStyle, pointerEvents: 'none' }}>
            {item.icon === 'sparkles' ? <Sparkles size={13} style={{ color: 'var(--color-accent)' }} /> : <Inbox size={13} />}
            {item.label}
          </div>
        )
      )}
    </div>,
    document.body
  )
}

function PlacementPreviewOverlay({
  active,
  plan,
}: {
  active: boolean
  plan: PlacementPlan | null
}) {
  const editor = useEditor()
  type PreviewRect = {
    id: string
    x: number
    y: number
    width: number
    height: number
    type: 'capture' | 'board' | 'board-child'
  }

  const preview = useValue(
    'holdingCellPlacementPreview',
    () => {
      if (!active || !plan) return null

      const anchor = editor.inputs.getCurrentPagePoint()
      const topLeft = editor.pageToViewport({ x: anchor.x, y: anchor.y })
      const zoom = editor.getZoomLevel()

      return {
        left: topLeft.x,
        top: topLeft.y,
        width: plan.width * zoom,
        height: plan.height * zoom,
        items: plan.items.flatMap<PreviewRect>((item) => {
          if (item.type === 'board') {
            return [
              {
                id: `board:${item.board.id}`,
                x: item.x * zoom,
                y: item.y * zoom,
                width: item.width * zoom,
                height: item.height * zoom,
                type: 'board' as const,
              },
              ...item.children.map((child, index) => ({
                id: `board:${item.board.id}:child:${child.artifact.id}:${index}`,
                x: (item.x + child.x) * zoom,
                y: (item.y + child.y) * zoom,
                width: child.width * zoom,
                height: child.height * zoom,
                type: 'board-child' as const,
              })),
            ]
          }

          return [
            {
              id: item.artifact.id,
              x: item.x * zoom,
              y: item.y * zoom,
              width: item.width * zoom,
              height: item.height * zoom,
              type: 'capture' as const,
            },
          ]
        }),
      }
    },
    [active, editor, plan]
  )

  if (!preview) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: preview.left,
        top: preview.top,
        width: preview.width,
        height: preview.height,
        pointerEvents: 'none',
        zIndex: 1350,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--radius-xl)',
          border: '1px dashed color-mix(in srgb, var(--color-accent) 60%, var(--color-border))',
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
        }}
      />
      {preview.items.map((item) => (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            width: item.width,
            height: item.height,
            borderRadius: 'var(--radius-lg)',
            border: item.type === 'board'
              ? '1px dashed color-mix(in srgb, var(--color-text) 28%, var(--color-border))'
              : item.type === 'board-child'
                ? '1px solid color-mix(in srgb, var(--color-text) 12%, var(--color-border))'
              : '1px solid color-mix(in srgb, var(--color-text) 16%, var(--color-border))',
            backgroundColor: item.type === 'board'
              ? 'color-mix(in srgb, var(--color-text) 4%, var(--color-surface))'
              : item.type === 'board-child'
                ? 'color-mix(in srgb, var(--color-surface) 64%, transparent)'
              : 'color-mix(in srgb, var(--color-surface) 72%, transparent)',
            boxShadow: 'var(--shadow-card)',
            opacity: item.type === 'board-child' ? 0.58 : 0.75,
          }}
        />
      ))}
    </div>
  )
}

function PlacementDecisionModal({
  open,
  title,
  description,
  confirmLabel,
  hideCancel = false,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  hideCancel?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        backgroundColor: 'color-mix(in srgb, var(--color-text) 34%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(420px, calc(100vw - 48px))',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-panel)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
              {title}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-muted)' }}>{description}</div>
          </div>
          <Button
            onClick={onClose}
            variant="outline"
            size="icon-sm"
            className="rounded-full text-[var(--color-muted)] bg-[var(--color-bg)]"
            aria-label="Close decision modal"
          >
            <X size={14} />
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {!hideCancel ? (
            <Button onClick={onClose} variant="outline" size="lg" className="rounded-full bg-[var(--color-bg)]">
              Cancel
            </Button>
          ) : null}
          <Button
            onClick={onConfirm}
            size="lg"
            className="rounded-full bg-[var(--color-accent)] text-[var(--color-surface)] hover:bg-[color-mix(in_srgb,var(--color-accent)_88%,black_12%)]"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function BoardProcessingOverlay({
  frameShapeId,
  active,
  label,
}: {
  frameShapeId: TLShapeId | null
  active: boolean
  label: string
}) {
  const editor = useEditor()

  const overlayBounds = useValue(
    'boardProcessingOverlayBounds',
    () => {
      if (!active || !frameShapeId) return null

      const frame = editor.getShape(frameShapeId)
      if (!frame || frame.type !== 'frame') return null

      const bounds = editor.getShapePageBounds(frame)
      if (!bounds) return null

      const topLeft = editor.pageToViewport({ x: bounds.minX, y: bounds.minY })
      const bottomRight = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY })

      return {
        left: topLeft.x,
        top: topLeft.y,
        width: Math.max(0, bottomRight.x - topLeft.x),
        height: Math.max(0, bottomRight.y - topLeft.y),
      }
    },
    [active, editor, frameShapeId]
  )

  if (!overlayBounds) return null

  return (
    <div
      className="grain-board-processing-overlay"
      style={{
        left: overlayBounds.left,
        top: overlayBounds.top,
        width: overlayBounds.width,
        height: overlayBounds.height,
      }}
    >
      <div className="grain-board-processing-overlay__label">{label}</div>
    </div>
  )
}

const pillStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: '999px',
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-toolbar)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-family)',
  fontSize: 12,
  cursor: 'pointer',
}
