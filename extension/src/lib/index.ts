export type SendToGrainSourceChannel = 'extension'

export type SendToGrainSourceType =
  | 'url'
  | 'page_url'
  | 'image_upload'
  | 'direct_media_url'

export type SendToGrainContentKind =
  | 'bookmark'
  | 'embed_candidate'
  | 'image'
  | 'video'

export type SendToGrainStatus =
  | 'received'
  | 'ready'
  | 'applied'
  | 'failed'

export interface SendToGrainRequest {
  sourceChannel: SendToGrainSourceChannel
  sourceType: SendToGrainSourceType
  originalUrl?: string
  canonicalUrl?: string
  title?: string
  siteName?: string
  previewImageUrl?: string
  contentKind?: SendToGrainContentKind
  targetPageId?: string | null
  targetPageName?: string | null
  metadata?: Record<string, unknown>
}

export interface SendToGrainResponse {
  captureId: string
  canvasId: string
  status: SendToGrainStatus
}

export interface SendToGrainConfig {
  baseUrl: string
  accessToken: string
  connectedAt: string
  targetPageId?: string | null
  targetPageName?: string | null
}

export interface SendToGrainPage {
  id: string
  name: string
  index: string
}

export const EXTENSION_NAME = 'Send to Grain'
export const CONFIG_STORAGE_KEY = 'grain-send-to-grain-config'
