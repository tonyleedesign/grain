'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { pendingCaptureToArtifact } from '@/lib/capture-placement'
import { requestArtifactOrganizePlan } from '@/lib/organizeImages'
import type { PendingCapture } from '@/types/captures'
import type {
  HoldingCellArtifact,
  HoldingCellBoardProposal,
  HoldingCellDraft,
  HoldingCellMode,
} from '@/types/holding-cell'
import type { OrganizeArtifactInput, OrganizeArtifactPreview } from '@/types/organize'

const HOLDING_CELL_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 6

function getHoldingCellStorageKey(canvasId: string) {
  return `grain:holding-cell:${canvasId}`
}

export interface UseHoldingCellReturn {
  // State exposed to CanvasUI for rendering
  pendingCaptures: PendingCapture[]
  holdingArtifacts: HoldingCellArtifact[]
  holdingOpen: boolean
  holdingMode: HoldingCellMode
  holdingSelectedIds: string[]
  groupedBoards: HoldingCellBoardProposal[]
  groupReviewCaptureIds: string[]
  groupedSnapshotSelectedIds: string[]
  isGroupingHolding: boolean
  newCapturesForReviewIds: string[]
  sessionNewCaptureIds: string[]
  hasGroupedSnapshot: boolean
  groupedArtifactIds: Set<string>
  groupReviewCaptureIdSet: Set<string>
  footerNoticeText: string

  // Refs exposed for CanvasUI's onPlacementCancelled and clusterItems
  groupedBoardsRef: React.MutableRefObject<HoldingCellBoardProposal[]>
  holdingModeRef: React.MutableRefObject<HoldingCellMode>
  groupReviewCaptureIdsRef: React.MutableRefObject<string[]>
  newCapturesForReviewIdsRef: React.MutableRefObject<string[]>

  // Actions
  openHoldingCell: () => void
  closeHoldingCell: () => void
  deletePendingCapture: (captureId: string) => Promise<void>
  handleSelectionChange: (selectedIds: string[]) => void
  handleGroup: () => Promise<void>
  handleRejectPlan: () => void
  handleFooterReviewNewCaptures: () => void
  handleBackToGroupedPlan: () => void
  markCapturesApplied: (captureIds: string[]) => Promise<void>
  getAuthHeaders: () => Promise<{ Authorization: string } | null>

  // Placement integration
  getSelection: () => { boards: HoldingCellBoardProposal[]; artifacts: HoldingCellArtifact[]; selectedIds: string[] }
  onPlacementComplete: (appliedCaptureIds: string[]) => void
  enterPlacementMode: () => void
  exitPlacementMode: () => void
}

export function useHoldingCell(canvasId: string, accessToken?: string | null): UseHoldingCellReturn {
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

  // Ref sync effects
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

  // holdingMode 'group-review' sync effect
  useEffect(() => {
    if (holdingMode === 'group-review') {
      setGroupedSnapshotSelectedIds(holdingSelectedIds)
    }
  }, [holdingMode, holdingSelectedIds])

  // localStorage hydration effect
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

  // localStorage persistence effect
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

  // Polling effect
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

  const handleRejectPlan = useCallback(() => {
    setGroupedBoards([])
    setGroupReviewCaptureIds([])
    setGroupedSnapshotSelectedIds([])
    setNewCapturesForReviewIds([])
    setHoldingMode('review')
    setHoldingSelectedIds(pendingCaptures.map((capture) => capture.id))
    setHoldingSelectionClearedByUser(false)
  }, [pendingCaptures])

  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setHoldingSelectedIds(selectedIds)
    setHoldingSelectionClearedByUser(selectedIds.length === 0)
  }, [])

  const handleGroup = useCallback(async () => {
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

      const authHeaders = await getAuthHeaders()
      const plan = await requestArtifactOrganizePlan(input, canvasId, previewMap, authHeaders)
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
  }, [canvasId, getAuthHeaders, holdingArtifacts, holdingSelectedIds, isGroupingHolding])

  const onPlacementComplete = useCallback((appliedCaptureIds: string[]) => {
    const appliedIds = new Set(appliedCaptureIds)
    const nextGroupedBoards = groupedBoardsRef.current
      .map((board) => ({
        ...board,
        artifacts: board.artifacts.filter((artifact) => !appliedIds.has(artifact.id)),
      }))
      .filter((board) => board.artifacts.length > 0)
    const validBoardSelectionIds = new Set(nextGroupedBoards.map((board) => `board:${board.id}`))
    const nextGroupReviewCaptureIds = groupReviewCaptureIdsRef.current.filter((id) => !appliedIds.has(id))
    const nextGroupedSnapshotSelectedIds = groupedSnapshotSelectedIdsRef.current.filter(
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
  }, [])

  const enterPlacementMode = useCallback(() => {
    setHoldingOpen(false)
    setHoldingMode('placement')
  }, [])

  const exitPlacementMode = useCallback(() => {
    setHoldingMode(groupedBoardsRef.current.length > 0 ? 'group-review' : 'review')
    setHoldingOpen(true)
  }, [])

  const openHoldingCell = useCallback(() => {
    setHoldingOpen(true)
    setHoldingDismissedThisSession(false)
    if (!(holdingModeRef.current === 'group-review' && (groupedBoardsRef.current.length > 0 || groupReviewCaptureIdsRef.current.length > 0))) {
      setSessionNewCaptureIds(newCapturesForReviewIdsRef.current)
      setNewCapturesForReviewIds([])
    }
  }, [])

  const closeHoldingCell = useCallback(() => {
    setHoldingOpen(false)
    setHoldingDismissedThisSession(true)
    setSessionNewCaptureIds([])
  }, [])

  const getSelection = useCallback(() => ({
    boards: groupedBoards.filter((board) =>
      holdingSelectedIds.filter((id) => id.startsWith('board:')).map((id) => id.replace(/^board:/, '')).includes(board.id)
    ),
    artifacts: holdingArtifacts.filter((artifact) => holdingSelectedIds.includes(artifact.id)),
    selectedIds: holdingSelectedIds,
  }), [groupedBoards, holdingArtifacts, holdingSelectedIds])

  // Footer "Review them" CTA: switch from group-review to review mode with new captures
  const handleFooterReviewNewCaptures = useCallback(() => {
    setGroupedSnapshotSelectedIds(holdingSelectedIds)
    setHoldingMode('review')
    setHoldingSelectedIds(pendingCaptures.map((capture) => capture.id))
    setSessionNewCaptureIds(newCapturesForReviewIds)
    setNewCapturesForReviewIds([])
  }, [holdingSelectedIds, newCapturesForReviewIds, pendingCaptures])

  // Footer "Back to grouped plan" link: switch from review back to group-review mode
  const handleBackToGroupedPlan = useCallback(() => {
    setHoldingMode('group-review')
    setHoldingSelectedIds(
      groupedSnapshotSelectedIds.length > 0
        ? groupedSnapshotSelectedIds
        : [
            ...groupedBoards.map((board) => `board:${board.id}`),
            ...groupReviewCaptureIds,
          ]
    )
  }, [groupedBoards, groupReviewCaptureIds, groupedSnapshotSelectedIds])

  // Derived values
  const groupedArtifactIds = useMemo(
    () => new Set(groupedBoards.flatMap((board) => board.artifacts.map((artifact) => artifact.id))),
    [groupedBoards]
  )
  const groupReviewCaptureIdSet = useMemo(() => new Set(groupReviewCaptureIds), [groupReviewCaptureIds])
  const footerNoticeText = newCapturesForReviewIds.length === 1
    ? '1 new capture available'
    : `${newCapturesForReviewIds.length} new captures available`
  const hasGroupedSnapshot = groupedBoards.length > 0 || groupReviewCaptureIds.length > 0

  return {
    // State
    pendingCaptures,
    holdingArtifacts,
    holdingOpen,
    holdingMode,
    holdingSelectedIds,
    groupedBoards,
    groupReviewCaptureIds,
    groupedSnapshotSelectedIds,
    isGroupingHolding,
    newCapturesForReviewIds,
    sessionNewCaptureIds,
    hasGroupedSnapshot,
    groupedArtifactIds,
    groupReviewCaptureIdSet,
    footerNoticeText,

    // Refs
    groupedBoardsRef,
    holdingModeRef,
    groupReviewCaptureIdsRef,
    newCapturesForReviewIdsRef,

    // Actions
    openHoldingCell,
    closeHoldingCell,
    deletePendingCapture,
    handleSelectionChange,
    handleGroup,
    handleRejectPlan,
    handleFooterReviewNewCaptures,
    handleBackToGroupedPlan,
    markCapturesApplied,
    getAuthHeaders,

    // Placement integration
    getSelection,
    onPlacementComplete,
    enterPlacementMode,
    exitPlacementMode,
  }
}
