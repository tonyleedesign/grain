export type CaptureSourceChannel = 'extension' | 'telegram'

export type CaptureSourceType =
  | 'url'
  | 'page_url'
  | 'image_upload'
  | 'direct_media_url'

export type CaptureContentKind =
  | 'bookmark'
  | 'embed_candidate'
  | 'image'
  | 'video'

export type CaptureStatus =
  | 'received'
  | 'ready'
  | 'applied'
  | 'failed'

export interface CaptureIngestRequest {
  sourceChannel: CaptureSourceChannel
  sourceType: CaptureSourceType
  originalUrl?: string
  canonicalUrl?: string
  title?: string
  siteName?: string
  previewImageUrl?: string
  contentKind?: CaptureContentKind
  targetPageId?: string | null
  targetPageName?: string | null
  metadata?: Record<string, unknown>
}

export interface CaptureIngestResponse {
  captureId: string
  canvasId: string
  status: CaptureStatus
}

export interface PendingCapture {
  id: string
  canvas_id: string
  source_channel: CaptureSourceChannel
  source_type: CaptureSourceType
  original_url: string | null
  canonical_url: string | null
  title: string | null
  site_name: string | null
  preview_image_url: string | null
  content_kind: CaptureContentKind
  image_id: string | null
  storage_path: string | null
  metadata: Record<string, unknown>
  status: CaptureStatus
  created_at: string
  updated_at: string
}

export interface CapturePageSummary {
  id: string
  name: string
  index: string
}
