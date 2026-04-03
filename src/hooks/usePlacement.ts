'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Editor, TLFrameShape, TLPageId, TLShapeId } from 'tldraw'
import { commitPlacementPlan, findBoardOverlap } from '@/lib/capture-placement'
import { applyOrganizePlan } from '@/lib/organizeImages'
import type { PlacementPlan } from '@/types/holding-cell'
import type { OrganizePlanBoardPreview } from '@/types/organize'

export interface UsePlacementCallbacks {
  markCapturesApplied: (captureIds: string[]) => Promise<void>
  onPlacementFinalized: (appliedCaptureIds: string[]) => void
  onPlacementCancelled: () => void
  onOrganizePlacementFinished: (outcome: 'committed' | 'cancelled') => void
}

export interface UsePlacementReturn {
  placementPlan: PlacementPlan | null
  placementError: string | null
  placementOverlapFrameId: TLShapeId | null
  placementPendingAnchor: { x: number; y: number } | null
  startPlacement: (
    plan: PlacementPlan,
    source: 'holding-cell' | 'organize',
    boards?: OrganizePlanBoardPreview[]
  ) => void
  cancelPlacement: () => void
  confirmOverlapPlacement: () => Promise<void>
  dismissOverlapPrompt: () => void
  dismissError: () => void
}

export function usePlacement(
  editor: Editor,
  canvasId: string,
  callbacks: UsePlacementCallbacks
): UsePlacementReturn {
  const [placementPlan, setPlacementPlan] = useState<PlacementPlan | null>(null)
  const [placementSource, setPlacementSource] = useState<'holding-cell' | 'organize' | null>(null)
  const [organizePlacementBoards, setOrganizePlacementBoards] = useState<OrganizePlanBoardPreview[]>([])
  const [placementOverlapFrameId, setPlacementOverlapFrameId] = useState<TLShapeId | null>(null)
  const [placementPendingAnchor, setPlacementPendingAnchor] = useState<{ x: number; y: number } | null>(null)
  const [placementError, setPlacementError] = useState<string | null>(null)

  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const clearPlacementState = useCallback(() => {
    setPlacementPlan(null)
    setPlacementSource(null)
    setOrganizePlacementBoards([])
    setPlacementOverlapFrameId(null)
    setPlacementPendingAnchor(null)
    setPlacementError(null)
  }, [])

  const finalizePlacement = useCallback(
    async (anchor: { x: number; y: number }, targetBoardFrame: TLFrameShape | null) => {
      if (!placementPlan) return

      if (placementSource === 'organize') {
        await applyOrganizePlan(editor, canvasId, organizePlacementBoards, {
          anchor,
          plan: placementPlan,
          preserveDimensions: true,
        })
        clearPlacementState()
        callbacksRef.current.onOrganizePlacementFinished('committed')
        return
      }

      const result = await commitPlacementPlan({
        editor,
        canvasId,
        pageId: editor.getCurrentPageId() as TLPageId,
        anchor,
        plan: placementPlan,
        targetBoardFrame,
      })

      await callbacksRef.current.markCapturesApplied(result.captureIds)
      clearPlacementState()
      callbacksRef.current.onPlacementFinalized(result.captureIds)
    },
    [canvasId, clearPlacementState, editor, organizePlacementBoards, placementPlan, placementSource]
  )

  const startPlacement = useCallback(
    (plan: PlacementPlan, source: 'holding-cell' | 'organize', boards?: OrganizePlanBoardPreview[]) => {
      setPlacementPlan(plan)
      setPlacementSource(source)
      setOrganizePlacementBoards(boards || [])
      setPlacementOverlapFrameId(null)
      setPlacementPendingAnchor(null)
      setPlacementError(null)
    },
    []
  )

  const cancelPlacement = useCallback(() => {
    const source = placementSource
    clearPlacementState()
    if (source === 'organize') {
      callbacksRef.current.onOrganizePlacementFinished('cancelled')
    } else {
      callbacksRef.current.onPlacementCancelled()
    }
  }, [clearPlacementState, placementSource])

  useEffect(() => {
    if (!placementPlan) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelPlacement()
      }
    }

    const handlePointerDown = async (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('.tlui-layout')) return
      if (target.closest('.grain-dna-panel')) return

      const anchor = editor.inputs.getCurrentPagePoint()
      const overlapFrame = findBoardOverlap(editor, editor.getCurrentPageId() as TLPageId, anchor, placementPlan)

      if (overlapFrame) {
        if (placementPlan.containsBoards) {
          setPlacementError("Boards can't be placed inside other boards.")
          return
        }
        setPlacementPendingAnchor(anchor)
        setPlacementOverlapFrameId(overlapFrame.id)
        return
      }

      try {
        await finalizePlacement(anchor, null)
      } catch (error) {
        setPlacementError(error instanceof Error ? error.message : 'Failed to place captures')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown, { capture: true })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
    }
  }, [cancelPlacement, editor, finalizePlacement, placementPlan])

  const confirmOverlapPlacement = useCallback(async () => {
    if (!placementOverlapFrameId || !placementPendingAnchor) return
    const frame = editor.getShape(placementOverlapFrameId) as TLFrameShape | undefined
    if (!frame) {
      setPlacementOverlapFrameId(null)
      setPlacementPendingAnchor(null)
      return
    }
    try {
      await finalizePlacement(placementPendingAnchor, frame)
    } catch (error) {
      setPlacementError(error instanceof Error ? error.message : 'Failed to place captures')
    }
  }, [editor, finalizePlacement, placementOverlapFrameId, placementPendingAnchor])

  const dismissOverlapPrompt = useCallback(() => {
    setPlacementOverlapFrameId(null)
    setPlacementPendingAnchor(null)
  }, [])

  const dismissError = useCallback(() => setPlacementError(null), [])

  return {
    placementPlan,
    placementError,
    placementOverlapFrameId,
    placementPendingAnchor,
    startPlacement,
    cancelPlacement,
    confirmOverlapPlacement,
    dismissOverlapPrompt,
    dismissError,
  }
}
