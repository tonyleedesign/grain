import type { OrganizeArtifactPreview } from './organize'

export type HoldingCellMode = 'review' | 'group-review' | 'placement'

export interface HoldingCellArtifact extends OrganizeArtifactPreview {
  sourceChannel: 'extension' | 'telegram'
  siteName?: string
  targetPageId?: string | null
  targetPageName?: string | null
}

export interface HoldingCellBoardProposal {
  id: string
  board_name: string
  reason: string
  artifacts: HoldingCellArtifact[]
}

export interface HoldingCellDraft {
  canvasId: string
  pendingCaptureIds: string[]
  seenCaptureIds: string[]
  selectedIds: string[]
  mode: HoldingCellMode
  groupedBoards: HoldingCellBoardProposal[]
  groupReviewCaptureIds: string[]
  groupedSnapshotSelectedIds: string[]
  modalOpen: boolean
  savedAt: number
}

export interface PlacementPlanItemRect {
  id: string
  x: number
  y: number
  width: number
  height: number
  kind: 'capture' | 'board'
}

export interface PlacementPlanCaptureItem {
  type: 'capture'
  artifact: HoldingCellArtifact
  x: number
  y: number
  width: number
  height: number
}

export interface PlacementPlanBoardChild {
  artifact: HoldingCellArtifact
  x: number
  y: number
  width: number
  height: number
}

export interface PlacementPlanBoardItem {
  type: 'board'
  board: HoldingCellBoardProposal
  x: number
  y: number
  width: number
  height: number
  children: PlacementPlanBoardChild[]
}

export interface PlacementPlan {
  width: number
  height: number
  items: Array<PlacementPlanCaptureItem | PlacementPlanBoardItem>
  captureIds: string[]
  containsBoards: boolean
}
