import type { PlacementPlan } from '@/types/holding-cell'
import type { OrganizePlanBoardPreview } from '@/types/organize'

export interface CanvasCallbacks {
  // CanvasUI → GrainToolbar direction (placement finished)
  onPlacementFinished: ((outcome: 'committed' | 'cancelled') => void) | null

  // GrainToolbar → CanvasUI direction
  onOrganizeStatusChange: ((active: boolean, label: string) => void) | null
  onOrganizeReviewOpenChange: ((open: boolean) => void) | null
  onStartPlacement: ((plan: PlacementPlan, boards: OrganizePlanBoardPreview[], canvasId: string) => void) | null

  // GrainImageToolbar/GrainContextMenu → CanvasUI direction
  onAskAI: ((anchor?: { x: number; y: number }) => void) | null
}
