import {
  getPrivateCanvasId,
  getStoredConfig,
  sendToGrain,
  uploadScreenshot,
} from '../grain-client.js'
import { captureElementScreenshot } from './element.js'
import { captureFullPageScreenshot } from './full-page.js'
import type { ScreenshotCaptureResult, ScreenshotMode } from './types.js'
import { captureViewportScreenshot } from './viewport.js'

async function captureScreenshot(
  tabId: number,
  mode: ScreenshotMode
): Promise<ScreenshotCaptureResult> {
  switch (mode) {
    case 'viewport':
      return captureViewportScreenshot()
    case 'full_page':
      return captureFullPageScreenshot(tabId)
    case 'element':
      return captureElementScreenshot(tabId)
    default: {
      const exhaustiveCheck: never = mode
      throw new Error(`Unsupported screenshot mode: ${String(exhaustiveCheck)}`)
    }
  }
}

export async function captureAndSendScreenshot(
  tabId: number,
  tabUrl: string | undefined,
  tabTitle: string | undefined,
  mode: ScreenshotMode
) {
  const config = await getStoredConfig()
  if (!config) {
    throw new Error('Connect Grain first')
  }

  const capture = await captureScreenshot(tabId, mode)
  const canvasId = await getPrivateCanvasId(config)
  const { url, width, height } = await uploadScreenshot(capture.dataUrl, canvasId, config)

  await sendToGrain(
    {
      sourceChannel: 'extension',
      sourceType: 'image_upload',
      contentKind: 'image',
      originalUrl: tabUrl,
      title: tabTitle,
      previewImageUrl: url,
      metadata: {
        width,
        height,
        ...capture.metadata,
      },
    },
    config
  )
}
