'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, useValue, TLShapeId } from 'tldraw'
import { useDNAPanel } from '@/hooks/useDNAPanel'
import { usePlacement } from '@/hooks/usePlacement'
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
  pendingCaptureToArtifact,
} from '@/lib/capture-placement'
import { requestArtifactOrganizePlan } from '@/lib/organizeImages'
import { supabase } from '@/lib/supabase'
import type { PendingCapture } from '@/types/captures'
import type {
  HoldingCellArtifact,
  HoldingCellBoardProposal,
  HoldingCellDraft,
  HoldingCellMode,
  PlacementPlan,
} from '@/types/holding-cell'
import type { OrganizeArtifactInput, OrganizeArtifactPreview, OrganizePlanBoardPreview } from '@/types/organize'

interface CanvasUIProps {
  canvasId: string
  accessToken?: string | null
}

interface OrganizeStatusDetail {
  active?: boolean
  label?: string
}

interface PlacementStartDetail {
  source: 'organize'
  plan: PlacementPlan
  boards: OrganizePlanBoardPreview[]
  canvasId: string
}

const HOLDING_CELL_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 6

function getHoldingCellStorageKey(canvasId: string) {
  return `grain:holding-cell:${canvasId}`
}

export function CanvasUI({ canvasId, accessToken }: CanvasUIProps) {
  const editor = useEditor()
  const { isDefaultTheme, resetTheme } = useTheme()
  const dnaPanel = useDNAPanel()
  useBoardIdentity(editor, canvasId)
  const [toolbarAI, setToolbarAI] = useState(false)
  const [toolbarAIAnchor, setToolbarAIAnchor] = useState<{ x: number; y: number } | null>(null)
  const [aiBarVisible, setAiBarVisible] = useState(false)
  const [clusterAnchor, setClusterAnchor] = useState<{ left: number; top: number } | null>(null)
  const [pendingCaptures, setPendingCaptures] = useState<PendingCapture[]>([])
  const [holdingSelectedIds, setHoldingSelectedIds] = useState<string[]>([])
  const [holdingSelectionClearedByUser, setHoldingSelectionClearedByUser] = useState(false)
  const [holdingOpen, setHoldingOpen] = useState(false)
  const [holdingMode, setHoldingMode] = useState<HoldingCellMode>('review')
  const [groupedBoards, setGroupedBoards] = useState<HoldingCellBoardProposal[]>([])
  const [groupReviewCaptureIds, setGroupReviewCaptureIds] = useState<string[]>([])
  const [groupedSnapshotSelectedIds, setGroupedSnapshotSelectedIds] = useState<string[]>([])
  const [isGroupingHolding, setIsGroupingHolding] = useState(false)
  const [draftHydrated, setDraftHydrated] = useState(false)
  const [seenCaptureIds, setSeenCaptureIds] = useState<string[]>([])
  const [newCapturesForReviewIds, setNewCapturesForReviewIds] = useState<string[]>([])
  const [sessionNewCaptureIds, setSessionNewCaptureIds] = useState<string[]>([])
  const [holdingDismissedThisSession, setHoldingDismissedThisSession] = useState(false)
  const [organizeReviewOpen, setOrganizeReviewOpen] = useState(false)
  const [organizeStatus, setOrganizeStatus] = useState<{ active: boolean; label: string }>({
    active: false,
    label: 'Organizing artifacts...',
  })
  const capturePollTimeoutRef = useRef<number | null>(null)
  const groupedBoardsRef = useRef(groupedBoards)
  const groupReviewCaptureIdsRef = useRef(groupReviewCaptureIds)
  const groupedSnapshotSelectedIdsRef = useRef(groupedSnapshotSelectedIds)
  const holdingModeRef = useRef(holdingMode)
  const holdingSelectedIdsRef = useRef(holdingSelectedIds)
  const holdingSelectionClearedByUserRef = useRef(holdingSelectionClearedByUser)
  const seenCaptureIdsRef = useRef(seenCaptureIds)
  const newCapturesForReviewIdsRef = useRef(newCapturesForReviewIds)
  const holdingDismissedThisSessionRef = useRef(holdingDismissedThisSession)

  const storageKey = useMemo(() => getHoldingCellStorageKey(canvasId), [canvasId])
  const holdingArtifacts = useMemo(
    () => pendingCaptures.map((capture) => pendingCaptureToArtifact(capture)),
    [pendingCaptures]
  )

  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? accessToken
    if (!token) return null
    return { Authorization: `Bearer ${token}` }
  }, [accessToken])

  const markCapturesApplied = useCallback(async (captureIds: string[]) => {
    if (captureIds.length === 0) return
    const authHeaders = await getAuthHeaders()
    if (!authHeaders) throw new Error('Authentication required to mark captures applied')

    const response = await fetch('/api/send-to-grain/pending', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ canvasId, captureIds }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(errorText || 'Failed to mark captures applied')
    }
  }, [canvasId, getAuthHeaders])

  const placement = usePlacement(editor, canvasId, {
    markCapturesApplied,
    onPlacementFinalized: (appliedCaptureIds) => {
      const appliedIds = new Set(appliedCaptureIds)
      const nextGroupedBoards = groupedBoards
        .map((board) => ({
          ...board,
          artifacts: board.artifacts.filter((artifact) => !appliedIds.has(artifact.id)),
        }))
        .filter((board) => board.artifacts.length > 0)
      const validBoardSelectionIds = new Set(nextGroupedBoards.map((board) => `board:${board.id}`))
      const nextGroupReviewCaptureIds = groupReviewCaptureIds.filter((id) => !appliedIds.has(id))
      const nextGroupedSnapshotSelectedIds = groupedSnapshotSelectedIds.filter(
        (id) => !appliedIds.has(id) && (!id.startsWith('board:') || validBoardSelectionIds.has(id))
      )

      setPendingCaptures((current) => current.filter((capture) => !appliedIds.has(capture.id)))
      setGroupedBoards(nextGroupedBoards)
      setGroupReviewCaptureIds(nextGroupReviewCaptureIds)
      setGroupedSnapshotSelectedIds(nextGroupedSnapshotSelectedIds)
      setHoldingSelectedIds((current) =>
        current.filter((id) => !appliedIds.has(id) && (!id.startsWith('board:') || validBoardSelectionIds.has(id)))
      )
      setHoldingSelectionClearedByUser(false)
      setNewCapturesForReviewIds((current) => current.filter((id) => !appliedIds.has(id)))
      setHoldingMode(nextGroupedBoards.length > 0 || nextGroupReviewCaptureIds.length > 0 ? 'group-review' : 'review')
    },
    onPlacementCancelled: () => {
      setHoldingMode(groupedBoardsRef.current.length > 0 ? 'group-review' : 'review')
      setHoldingOpen(true)
    },
  })

  const clusterItems = useMemo(() => {
    const items: Array<
      | { id: string; type: 'button'; label: string; icon?: 'revert' | 'inbox'; onClick: () => void; highlight?: boolean }
      | { id: string; type: 'status'; label: string; icon?: 'sparkles' | 'inbox' }
    > = []

    if (!isDefaultTheme) {
      items.push({ id: 'revert-theme', type: 'button', label: 'Revert', icon: 'revert', onClick: resetTheme })
    }

    if (pendingCaptures.length > 0) {
      items.push({
        id: 'holding-cell',
        type: 'button',
        label: pendingCaptures.length === 1 ? '1 pending capture' : `${pendingCaptures.length} pending captures`,
        icon: 'inbox',
        onClick: () => {
          setHoldingOpen(true)
          setHoldingDismissedThisSession(false)
          if (!(holdingModeRef.current === 'group-review' && (groupedBoardsRef.current.length > 0 || groupReviewCaptureIdsRef.current.length > 0))) {
            setSessionNewCaptureIds(newCapturesForReviewIdsRef.current)
            setNewCapturesForReviewIds([])
          }
        },
        highlight: newCapturesForReviewIds.length > 0,
      })
    }

    if (organizeStatus.active) {
      items.push({ id: 'organize-status', type: 'status', label: organizeStatus.label, icon: 'sparkles' })
    }

    if (placement.placementPlan) {
      items.push({ id: 'placement-status', type: 'status', label: 'Click to place / Esc to cancel', icon: 'inbox' })
    }

    return items
  }, [isDefaultTheme, organizeStatus.active, organizeStatus.label, pendingCaptures.length, placement.placementPlan, resetTheme, newCapturesForReviewIds])

  const deletePendingCapture = useCallback(async (captureId: string) => {
    const authHeaders = await getAuthHeaders()
    if (!authHeaders) throw new Error('Authentication required to delete captures')

    const response = await fetch('/api/send-to-grain/pending', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ canvasId, captureIds: [captureId] }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(errorText || 'Failed to delete capture')
    }

    setPendingCaptures((current) => current.filter((capture) => capture.id !== captureId))
    setHoldingSelectedIds((current) => current.filter((id) => id !== captureId))
    setGroupReviewCaptureIds((current) => current.filter((id) => id !== captureId))
    setGroupedBoards((current) =>
      current
        .map((board) => ({
          ...board,
          artifacts: board.artifacts.filter((artifact) => artifact.id !== captureId),
        }))
        .filter((board) => board.artifacts.length > 0)
    )
    setGroupedSnapshotSelectedIds((current) => current.filter((id) => id !== captureId))
    setNewCapturesForReviewIds((current) => current.filter((id) => id !== captureId))
    setSessionNewCaptureIds((current) => current.filter((id) => id !== captureId))
    setSeenCaptureIds((current) => current.filter((id) => id !== captureId))
  }, [canvasId, getAuthHeaders])

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

  useEffect(() => {
    groupedBoardsRef.current = groupedBoards
  }, [groupedBoards])

  useEffect(() => {
    groupReviewCaptureIdsRef.current = groupReviewCaptureIds
  }, [groupReviewCaptureIds])

  useEffect(() => {
    groupedSnapshotSelectedIdsRef.current = groupedSnapshotSelectedIds
  }, [groupedSnapshotSelectedIds])

  useEffect(() => {
    holdingModeRef.current = holdingMode
  }, [holdingMode])

  useEffect(() => {
    holdingSelectedIdsRef.current = holdingSelectedIds
  }, [holdingSelectedIds])

  useEffect(() => {
    holdingSelectionClearedByUserRef.current = holdingSelectionClearedByUser
  }, [holdingSelectionClearedByUser])

  useEffect(() => {
    seenCaptureIdsRef.current = seenCaptureIds
  }, [seenCaptureIds])

  useEffect(() => {
    newCapturesForReviewIdsRef.current = newCapturesForReviewIds
  }, [newCapturesForReviewIds])

  useEffect(() => {
    holdingDismissedThisSessionRef.current = holdingDismissedThisSession
  }, [holdingDismissedThisSession])

  useEffect(() => {
    if (holdingMode === 'group-review') {
      setGroupedSnapshotSelectedIds(holdingSelectedIds)
    }
  }, [holdingMode, holdingSelectedIds])

  const handleRejectHoldingPlan = useCallback(() => {
    setGroupedBoards([])
    setGroupReviewCaptureIds([])
    setGroupedSnapshotSelectedIds([])
    setNewCapturesForReviewIds([])
    setHoldingMode('review')
    setHoldingSelectedIds(pendingCaptures.map((capture) => capture.id))
    setHoldingSelectionClearedByUser(false)
  }, [pendingCaptures])

  const handleHoldingSelectionChange = useCallback((selectedIds: string[]) => {
    setHoldingSelectedIds(selectedIds)
    setHoldingSelectionClearedByUser(selectedIds.length === 0)
  }, [])

  const handleBeginPlacement = useCallback(() => {
    const selectedBoardIds = new Set(
      holdingSelectedIds.filter((id) => id.startsWith('board:')).map((id) => id.replace(/^board:/, ''))
    )
    const selectedBoards = groupedBoards.filter((board) => selectedBoardIds.has(board.id))
    const selectedArtifacts = holdingArtifacts.filter((artifact) => holdingSelectedIds.includes(artifact.id))
    if (selectedBoards.length === 0 && selectedArtifacts.length === 0) return

    placement.startPlacement(buildPlacementPlan({ artifacts: selectedArtifacts, boards: selectedBoards }), 'holding-cell')
    setHoldingOpen(false)
    setHoldingMode('placement')
  }, [groupedBoards, holdingArtifacts, holdingSelectedIds, placement])

  useEffect(() => {
    const handleAskAI = (event: Event) => {
      const customEvent = event as CustomEvent<{ anchor?: { x: number; y: number } }>
      setToolbarAIAnchor(customEvent.detail?.anchor || null)
      setToolbarAI(true)
    }

    window.addEventListener('grain:ask-ai', handleAskAI)
    return () => window.removeEventListener('grain:ask-ai', handleAskAI)
  }, [])

  useEffect(() => {
    const handleOrganizeStatus = (event: Event) => {
      const detail = (event as CustomEvent<OrganizeStatusDetail>).detail || {}
      setOrganizeStatus({
        active: Boolean(detail.active),
        label: detail.label || 'Organizing artifacts...',
      })
    }

    window.addEventListener('grain:organize-status', handleOrganizeStatus)
    return () => window.removeEventListener('grain:organize-status', handleOrganizeStatus)
  }, [])

  useEffect(() => {
    const handleOrganizeReviewOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail || {}
      setOrganizeReviewOpen(Boolean(detail.open))
    }

    window.addEventListener('grain:organize-review-open', handleOrganizeReviewOpen)
    return () => window.removeEventListener('grain:organize-review-open', handleOrganizeReviewOpen)
  }, [])

  useEffect(() => {
    const handlePlacementStart = (event: Event) => {
      const detail = (event as CustomEvent<PlacementStartDetail>).detail
      if (!detail || detail.source !== 'organize' || detail.canvasId !== canvasId) return

      placement.startPlacement(detail.plan, 'organize', detail.boards)
    }

    window.addEventListener('grain:start-placement', handlePlacementStart)
    return () => window.removeEventListener('grain:start-placement', handlePlacementStart)
  }, [canvasId, placement.startPlacement])

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


  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        setDraftHydrated(true)
        return
      }

      const draft = JSON.parse(raw) as HoldingCellDraft
      const isExpired = Date.now() - draft.savedAt > HOLDING_CELL_DRAFT_MAX_AGE_MS
      if (isExpired || draft.canvasId !== canvasId) {
        window.localStorage.removeItem(storageKey)
        setDraftHydrated(true)
        return
      }

      setHoldingSelectedIds(Array.isArray(draft.selectedIds) ? draft.selectedIds : [])
      setHoldingSelectionClearedByUser(Array.isArray(draft.selectedIds) && draft.selectedIds.length === 0)
      setHoldingMode(draft.mode === 'group-review' ? 'group-review' : 'review')
      setGroupedBoards(Array.isArray(draft.groupedBoards) ? draft.groupedBoards : [])
      setGroupReviewCaptureIds(Array.isArray(draft.groupReviewCaptureIds) ? draft.groupReviewCaptureIds : [])
      setGroupedSnapshotSelectedIds(Array.isArray(draft.groupedSnapshotSelectedIds) ? draft.groupedSnapshotSelectedIds : [])
      setHoldingOpen(Boolean(draft.modalOpen))
      setSeenCaptureIds(Array.isArray(draft.seenCaptureIds) ? draft.seenCaptureIds : [])
    } catch {
      window.localStorage.removeItem(storageKey)
    } finally {
      setDraftHydrated(true)
    }
  }, [canvasId, storageKey])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftHydrated) return

    const draft: HoldingCellDraft = {
      canvasId,
      pendingCaptureIds: pendingCaptures.map((capture) => capture.id),
      seenCaptureIds,
      selectedIds: holdingSelectedIds,
      mode: holdingMode === 'placement' ? (groupedBoards.length > 0 ? 'group-review' : 'review') : holdingMode,
      groupedBoards,
      groupReviewCaptureIds,
      groupedSnapshotSelectedIds,
      modalOpen: holdingMode === 'placement' ? false : holdingOpen,
      savedAt: Date.now(),
    }

    window.localStorage.setItem(storageKey, JSON.stringify(draft))
  }, [
    canvasId,
    draftHydrated,
    groupReviewCaptureIds,
    groupedBoards,
    groupedSnapshotSelectedIds,
    holdingMode,
    holdingOpen,
    holdingSelectedIds,
    pendingCaptures,
    seenCaptureIds,
    storageKey,
  ])

  useEffect(() => {
    if (!accessToken) return

    let cancelled = false
    const FAST_POLL_MS = 1500
    const IDLE_POLL_MS = 4000

    const clearScheduledPoll = () => {
      if (capturePollTimeoutRef.current) {
        window.clearTimeout(capturePollTimeoutRef.current)
        capturePollTimeoutRef.current = null
      }
    }

    const scheduleNextPoll = (delay: number) => {
      clearScheduledPoll()
      if (cancelled) return
      capturePollTimeoutRef.current = window.setTimeout(() => {
        if (!cancelled && !document.hidden) {
          void loadPendingCaptures()
        }
      }, delay)
    }

    const loadPendingCaptures = async () => {
      let nextPollDelay = IDLE_POLL_MS

      try {
        let authHeaders = await getAuthHeaders()
        if (!authHeaders) return

        let response = await fetch(`/api/send-to-grain/pending?canvasId=${canvasId}`, {
          cache: 'no-store',
          headers: authHeaders,
        })

        if (response.status === 401) {
          authHeaders = await getAuthHeaders()
          if (!authHeaders) return

          response = await fetch(`/api/send-to-grain/pending?canvasId=${canvasId}`, {
            cache: 'no-store',
            headers: authHeaders,
          })
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '')
          console.error('Failed to fetch pending captures:', response.status, errorText)
          return
        }

        const data = (await response.json()) as { captures?: PendingCapture[] }
        const captures = (data.captures || []).slice().sort((a, b) => {
          const aTime = Date.parse(a.created_at)
          const bTime = Date.parse(b.created_at)
          return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
        })
        const captureIds = captures.map((capture) => capture.id)

        const activeCaptureIdSet = new Set(captureIds)
        const nextGroupedBoards = groupedBoardsRef.current
          .map((board) => ({
            ...board,
            artifacts: board.artifacts.filter((artifact) => activeCaptureIdSet.has(artifact.id)),
          }))
          .filter((board) => board.artifacts.length > 0)
        const validBoardIds = new Set(nextGroupedBoards.map((board) => `board:${board.id}`))
        const nextGroupReviewCaptureIds = groupReviewCaptureIdsRef.current.filter((id) => activeCaptureIdSet.has(id))
        const nextGroupedSnapshotSelectedIds = groupedSnapshotSelectedIdsRef.current.filter(
          (id) => activeCaptureIdSet.has(id) || validBoardIds.has(id)
        )

        setPendingCaptures(captures)
        setGroupedBoards(nextGroupedBoards)
        setGroupReviewCaptureIds(nextGroupReviewCaptureIds)
        setGroupedSnapshotSelectedIds(nextGroupedSnapshotSelectedIds)
        setHoldingSelectedIds((current) =>
          current.filter((id) => activeCaptureIdSet.has(id) || validBoardIds.has(id))
        )

        if (captures.length > 0) {
          const unseenIds = captureIds.filter((id) => !seenCaptureIdsRef.current.includes(id))
          if (unseenIds.length > 0) {
            setSeenCaptureIds((current) => Array.from(new Set([...current, ...captureIds])))
            const isGroupedReviewOpen = holdingOpen && holdingModeRef.current === 'group-review'

            if (isGroupedReviewOpen) {
              setNewCapturesForReviewIds((current) => Array.from(new Set([...current, ...unseenIds])))
            } else if (holdingDismissedThisSessionRef.current) {
              setNewCapturesForReviewIds((current) => Array.from(new Set([...current, ...unseenIds])))
            } else {
              setHoldingOpen(true)
              setSessionNewCaptureIds(unseenIds)
              setNewCapturesForReviewIds([])
              if (holdingModeRef.current !== 'group-review') {
                setHoldingMode('review')
                setHoldingSelectedIds(captureIds)
                setHoldingSelectionClearedByUser(false)
              }
            }
          } else if (
            holdingSelectedIdsRef.current.length === 0 &&
            !holdingSelectionClearedByUserRef.current &&
            holdingModeRef.current !== 'group-review'
          ) {
            setHoldingSelectedIds(captureIds)
            setHoldingSelectionClearedByUser(false)
          }
          nextPollDelay = FAST_POLL_MS
        } else {
          setHoldingSelectedIds([])
          setHoldingSelectionClearedByUser(false)
          setGroupedBoards([])
          setGroupReviewCaptureIds([])
          setGroupedSnapshotSelectedIds([])
          setSessionNewCaptureIds([])
          setNewCapturesForReviewIds([])
          setHoldingOpen(false)
          if (holdingModeRef.current !== 'placement') {
            setHoldingMode('review')
          }
        }
      } catch (error) {
        console.error('Failed to load pending captures:', error)
      } finally {
        if (!cancelled && !document.hidden) {
          scheduleNextPoll(nextPollDelay)
        }
      }
    }

    void loadPendingCaptures()

    const triggerImmediateSync = () => {
      if (!cancelled && !document.hidden) {
        clearScheduledPoll()
        void loadPendingCaptures()
      }
    }

    window.addEventListener('focus', triggerImmediateSync)
    window.addEventListener('pageshow', triggerImmediateSync)
    window.addEventListener('online', triggerImmediateSync)
    document.addEventListener('visibilitychange', triggerImmediateSync)

    return () => {
      cancelled = true
      clearScheduledPoll()
      window.removeEventListener('focus', triggerImmediateSync)
      window.removeEventListener('pageshow', triggerImmediateSync)
      window.removeEventListener('online', triggerImmediateSync)
      document.removeEventListener('visibilitychange', triggerImmediateSync)
    }
  }, [
    accessToken,
    canvasId,
    getAuthHeaders,
    holdingOpen,
  ])

  const handleGroupPendingCaptures = useCallback(async () => {
    if (isGroupingHolding) return

    const selectedArtifacts = holdingArtifacts.filter((artifact) => holdingSelectedIds.includes(artifact.id))
    if (selectedArtifacts.length === 0) return

    setIsGroupingHolding(true)

    try {
      const previewMap = new Map(
        selectedArtifacts.map((artifact) => [artifact.id, artifact as OrganizeArtifactPreview])
      )
      const input: OrganizeArtifactInput[] = selectedArtifacts.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        url: artifact.url,
        previewUrl: artifact.previewUrl,
        title: artifact.title,
        description: artifact.description,
        position_x: artifact.position_x,
        position_y: artifact.position_y,
      }))

      const plan = await requestArtifactOrganizePlan(input, canvasId, previewMap)
      if (!plan?.length) return

      const groupedArtifactIds = new Set(plan.flatMap((board) => board.artifacts.map((artifact) => artifact.id)))
      const leftoverArtifacts = selectedArtifacts.filter((artifact) => !groupedArtifactIds.has(artifact.id))

      setGroupedBoards(
        plan.map((board) => ({
          id: board.id,
          board_name: board.board_name,
          reason: board.reason,
          artifacts: board.artifacts as HoldingCellArtifact[],
        }))
      )
      setGroupReviewCaptureIds(leftoverArtifacts.map((artifact) => artifact.id))
      setHoldingMode('group-review')
      const nextSelectedIds = [...plan.map((board) => `board:${board.id}`), ...leftoverArtifacts.map((artifact) => artifact.id)]
      setGroupedSnapshotSelectedIds(nextSelectedIds)
      setHoldingSelectedIds(nextSelectedIds)
      setHoldingSelectionClearedByUser(false)
      setNewCapturesForReviewIds([])
    } finally {
      setIsGroupingHolding(false)
    }
  }, [canvasId, holdingArtifacts, holdingSelectedIds, isGroupingHolding])

  const groupedArtifactIds = useMemo(
    () => new Set(groupedBoards.flatMap((board) => board.artifacts.map((artifact) => artifact.id))),
    [groupedBoards]
  )
  const groupReviewCaptureIdSet = useMemo(() => new Set(groupReviewCaptureIds), [groupReviewCaptureIds])
  const footerNoticeText = newCapturesForReviewIds.length === 1
    ? '1 new capture available'
    : `${newCapturesForReviewIds.length} new captures available`
  const hasGroupedSnapshot = groupedBoards.length > 0 || groupReviewCaptureIds.length > 0

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

      {clusterItems.length > 0 && clusterAnchor && !holdingOpen && !organizeReviewOpen ? (
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
        />
      ) : null}

      <HoldingCellModal
        open={holdingOpen && pendingCaptures.length > 0}
        mode={holdingMode === 'placement' ? (groupedBoards.length > 0 ? 'group-review' : 'review') : holdingMode}
        captures={holdingMode === 'group-review'
          ? holdingArtifacts.filter((artifact) => groupReviewCaptureIdSet.has(artifact.id) && !groupedArtifactIds.has(artifact.id))
          : holdingArtifacts}
        groupedBoards={groupedBoards}
        newCaptureIds={sessionNewCaptureIds}
        selectedIds={holdingSelectedIds}
        isGrouping={isGroupingHolding}
        onSelectionChange={handleHoldingSelectionChange}
        onDeleteCapture={(captureId) => {
          void deletePendingCapture(captureId)
        }}
        onClose={() => {
          setHoldingOpen(false)
          setHoldingDismissedThisSession(true)
          setSessionNewCaptureIds([])
        }}
        onGroup={handleGroupPendingCaptures}
        onRejectPlan={handleRejectHoldingPlan}
        onPlaceSelected={handleBeginPlacement}
        footerNotice={holdingMode === 'group-review' && newCapturesForReviewIds.length > 0 ? {
          text: footerNoticeText,
          ctaLabel: 'Review them',
          onClick: () => {
            setGroupedSnapshotSelectedIds(holdingSelectedIds)
            setHoldingMode('review')
            setHoldingSelectedIds(pendingCaptures.map((capture) => capture.id))
            setSessionNewCaptureIds(newCapturesForReviewIds)
            setNewCapturesForReviewIds([])
          },
          animate: true,
        } : null}
        footerSecondaryLink={holdingMode === 'review' && hasGroupedSnapshot ? {
          label: 'Back to grouped plan',
          onClick: () => {
            setHoldingMode('group-review')
            setHoldingSelectedIds(groupedSnapshotSelectedIds.length > 0 ? groupedSnapshotSelectedIds : [
              ...groupedBoards.map((board) => `board:${board.id}`),
              ...groupReviewCaptureIds,
            ])
          },
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
