'use client'

import {
  AssetToolbarItem,
  ArrowDownToolbarItem,
  ArrowLeftToolbarItem,
  ArrowRightToolbarItem,
  ArrowToolbarItem,
  ArrowUpToolbarItem,
  CheckBoxToolbarItem,
  CloudToolbarItem,
  DefaultToolbar,
  DiamondToolbarItem,
  DrawToolbarItem,
  EllipseToolbarItem,
  EraserToolbarItem,
  FrameToolbarItem,
  HandToolbarItem,
  HeartToolbarItem,
  HexagonToolbarItem,
  HighlightToolbarItem,
  LaserToolbarItem,
  LineToolbarItem,
  NoteToolbarItem,
  OvalToolbarItem,
  RectangleToolbarItem,
  RhombusToolbarItem,
  SelectToolbarItem,
  StarToolbarItem,
  TextToolbarItem,
  TldrawUiButtonIcon,
  TldrawUiToolbarButton,
  TriangleToolbarItem,
  useToasts,
  useEditor,
  useValue,
  XBoxToolbarItem,
} from 'tldraw'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { applyOrganizePlan, getUngroupedOrganizeArtifacts, requestOrganizePlan } from '@/lib/organizeImages'
import { OrganizeReviewModal } from './OrganizeReviewModal'
import type { OrganizePlanBoardPreview, OrganizePlanDraft } from '@/types/organize'

interface GrainToolbarProps {
  canvasId: string
}

const ORGANIZE_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 6

function getOrganizeDraftStorageKey(canvasId: string, pageId: string) {
  return `grain:organize-draft:${canvasId}:${pageId}`
}

function OrganizeToolbarButton({ canvasId }: GrainToolbarProps) {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [proposals, setProposals] = useState<OrganizePlanBoardPreview[]>([])
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [organizeAnchor, setOrganizeAnchor] = useState<{ left: number; top: number } | null>(null)
  const [draftHydrated, setDraftHydrated] = useState(false)
  const currentPageId = useValue('currentPageId', () => String(editor.getCurrentPageId()), [editor])
  const hasPendingReview = proposals.length > 0 && !reviewOpen
  const draftStorageKey = useMemo(
    () => getOrganizeDraftStorageKey(canvasId, currentPageId),
    [canvasId, currentPageId]
  )

  const ungroupedCount = useValue(
    'ungroupedArtifactCount',
    () => getUngroupedOrganizeArtifacts(editor).length,
    [editor]
  )

  const handleOrganize = useCallback(async () => {
    if (isOrganizing) return

    if (!reviewOpen && proposals.length > 0) {
      setReviewOpen(true)
      return
    }

    if (ungroupedCount === 0) {
      addToast({
        title: 'Nothing to organize',
        description: 'Add or ungroup some images or links first.',
        severity: 'warning',
      })
      return
    }

    setIsOrganizing(true)
    try {
      const plan = await requestOrganizePlan(editor, canvasId)

      if (!plan?.length) {
        addToast({
          title: 'No plan returned',
          description: 'The organizer could not find a useful grouping.',
          severity: 'warning',
        })
        return
      }

      setProposals(plan)
      setSelectedProposalIds(plan.map((proposal) => proposal.id))
      setReviewOpen(true)
    } catch (error) {
      addToast({
        title: 'Organize failed',
        description: error instanceof Error ? error.message : 'Something went wrong.',
        severity: 'error',
      })
    } finally {
      setIsOrganizing(false)
    }
  }, [addToast, canvasId, editor, isOrganizing, proposals.length, reviewOpen, ungroupedCount])

  const handleApply = useCallback(
    async (selectedIds: string[]) => {
      const selectedBoards = proposals.filter((proposal) => selectedIds.includes(proposal.id))
      if (!selectedBoards.length) return

      setIsApplying(true)
      try {
        await applyOrganizePlan(editor, canvasId, selectedBoards)
        setReviewOpen(false)
        setProposals([])
        setSelectedProposalIds([])
      } catch (error) {
        addToast({
          title: 'Create boards failed',
          description: error instanceof Error ? error.message : 'Something went wrong.',
          severity: 'error',
        })
      } finally {
        setIsApplying(false)
      }
    },
    [addToast, canvasId, editor, proposals]
  )

  const handleRejectPlan = useCallback(() => {
    if (isApplying) return

    setReviewOpen(false)
    setProposals([])
    setSelectedProposalIds([])

    addToast({
      title: 'Plan dismissed',
      description: 'You can run Organize again to generate a new review.',
      severity: 'info',
    })
  }, [addToast, isApplying])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = window.localStorage.getItem(draftStorageKey)
      if (!raw) {
        setProposals([])
        setSelectedProposalIds([])
        setReviewOpen(false)
        return
      }

      const draft = JSON.parse(raw) as OrganizePlanDraft
      const isExpired = Date.now() - draft.savedAt > ORGANIZE_DRAFT_MAX_AGE_MS
      if (
        isExpired ||
        draft.canvasId !== canvasId ||
        draft.pageId !== currentPageId ||
        !Array.isArray(draft.proposals)
      ) {
        window.localStorage.removeItem(draftStorageKey)
        setProposals([])
        setSelectedProposalIds([])
        setReviewOpen(false)
        return
      }

      const validIds = new Set(draft.proposals.map((proposal) => proposal.id))
      const restoredSelectedIds = Array.isArray(draft.selectedIds)
        ? draft.selectedIds.filter((id) => validIds.has(id))
        : draft.proposals.map((proposal) => proposal.id)

      setProposals(draft.proposals)
      setSelectedProposalIds(restoredSelectedIds)
      setReviewOpen(Boolean(draft.reviewOpen))
    } catch {
      window.localStorage.removeItem(draftStorageKey)
      setProposals([])
      setSelectedProposalIds([])
      setReviewOpen(false)
    } finally {
      setDraftHydrated(true)
    }
  }, [canvasId, currentPageId, draftStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!draftHydrated) return

    if (proposals.length === 0) {
      window.localStorage.removeItem(draftStorageKey)
      return
    }

    const draft: OrganizePlanDraft = {
      canvasId,
      pageId: currentPageId,
      proposals,
      selectedIds: selectedProposalIds,
      reviewOpen,
      savedAt: Date.now(),
    }

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft))
  }, [canvasId, currentPageId, draftHydrated, draftStorageKey, proposals, reviewOpen, selectedProposalIds])

  useEffect(() => {
    if (!isOrganizing) return

    let frame = 0

    const updateAnchor = () => {
      const button = document.querySelector('.grain-organize-toolbar-button') as HTMLElement | null
      if (!button) {
        setOrganizeAnchor(null)
        return
      }

      const rect = button.getBoundingClientRect()
      setOrganizeAnchor({
        left: rect.left + rect.width / 2,
        top: rect.top - 8,
      })
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(updateAnchor)
    }

    scheduleUpdate()
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [isOrganizing])

  return (
    <>
      <TldrawUiToolbarButton
        type="tool"
        title="Organize"
        tooltip="Organize"
        disabled={isOrganizing || isApplying}
        onClick={handleOrganize}
        className={`grain-organize-toolbar-button${isOrganizing ? ' grain-organize-toolbar-button--loading' : ''}`}
      >
        {isOrganizing ? (
          <LoaderCircle
            size={16}
            style={{
              color: 'var(--color-surface)',
              position: 'relative',
              zIndex: 1,
              animation: 'grain-spin 0.8s linear infinite',
            }}
          />
        ) : (
          <TldrawUiButtonIcon icon="pack" />
        )}
        {hasPendingReview && !isOrganizing && (
          <span
            className="grain-organize-toolbar-button__badge"
            aria-hidden="true"
          />
        )}
      </TldrawUiToolbarButton>
      {isOrganizing &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: organizeAnchor?.left ?? window.innerWidth / 2,
              top: organizeAnchor?.top ?? 24,
              transform: 'translate(-50%, -100%)',
              zIndex: 1600,
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
              pointerEvents: 'none',
            }}
          >
            <Sparkles
              size={14}
              style={{
                color: 'var(--color-accent)',
                opacity: 0.9,
              }}
            />
            Organizing artifacts...
          </div>,
          document.body
        )}
      <OrganizeReviewModal
        open={reviewOpen}
        proposals={proposals}
        selectedIds={selectedProposalIds}
        isApplying={isApplying}
        onSelectionChange={setSelectedProposalIds}
        onApply={handleApply}
        onReject={handleRejectPlan}
        onClose={() => {
          if (isApplying) return
          setReviewOpen(false)
        }}
      />
    </>
  )
}

export function createGrainToolbar(canvasId: string) {
  return function GrainToolbar() {
    return (
      <DefaultToolbar>
        <SelectToolbarItem />
        <HandToolbarItem />
        <DrawToolbarItem />
        <TextToolbarItem />

        <OrganizeToolbarButton canvasId={canvasId} />

        <AssetToolbarItem />
        <NoteToolbarItem />
        <EraserToolbarItem />
        <RectangleToolbarItem />
        <EllipseToolbarItem />
        <TriangleToolbarItem />
        <DiamondToolbarItem />
        <HexagonToolbarItem />
        <OvalToolbarItem />
        <RhombusToolbarItem />
        <StarToolbarItem />
        <CloudToolbarItem />
        <HeartToolbarItem />
        <XBoxToolbarItem />
        <CheckBoxToolbarItem />
        <ArrowLeftToolbarItem />
        <ArrowUpToolbarItem />
        <ArrowDownToolbarItem />
        <ArrowRightToolbarItem />
        <LineToolbarItem />
        <HighlightToolbarItem />
        <LaserToolbarItem />
        <FrameToolbarItem />
        <ArrowToolbarItem />
      </DefaultToolbar>
    )
  }
}
