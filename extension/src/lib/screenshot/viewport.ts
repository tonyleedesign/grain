import { chromeApi } from '../chrome-api.js'
import type { ScreenshotCaptureResult } from './types.js'

export async function captureViewportScreenshot(): Promise<ScreenshotCaptureResult> {
  const dataUrl = await chromeApi.tabs.captureVisibleTab(null, {
    format: 'jpeg',
    quality: 92,
  })

  return {
    dataUrl,
    metadata: {
      captureMode: 'viewport',
    },
  }
}
