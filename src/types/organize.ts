export type OrganizeArtifactKind = 'image' | 'bookmark' | 'embed'

export interface OrganizeArtifactInput {
  id: string
  kind: OrganizeArtifactKind
  url: string
  previewUrl?: string
  title?: string
  description?: string
  position_x: number
  position_y: number
}

export interface OrganizePlanBoard {
  id: string
  board_name: string
  reason: string
  artifact_ids: string[]
}

export interface OrganizePlanResponse {
  boards: OrganizePlanBoard[]
}

export interface OrganizeArtifactPreview extends OrganizeArtifactInput {
  width: number
  height: number
}

export interface OrganizePlanBoardPreview extends OrganizePlanBoard {
  artifacts: OrganizeArtifactPreview[]
}

export interface OrganizePlanDraft {
  canvasId: string
  pageId: string
  proposals: OrganizePlanBoardPreview[]
  selectedIds: string[]
  reviewOpen: boolean
  savedAt: number
}
