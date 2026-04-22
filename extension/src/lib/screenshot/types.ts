export type ScreenshotMode = 'viewport' | 'full_page' | 'element'

export interface ScreenshotCaptureResult {
  dataUrl: string
  metadata?: Record<string, unknown>
}

export interface ElementSelectionResult {
  rect: {
    left: number
    top: number
    width: number
    height: number
  }
  viewport: {
    width: number
    height: number
  }
  tagName: string
}
