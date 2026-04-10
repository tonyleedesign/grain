import { chromeApi } from '../lib/chrome-api.js'
import { EXTENSION_NAME, type SendToGrainRequest } from '../lib/index.js'
import {
  clearStoredConfig,
  getPrivateCanvasId,
  getStoredConfig,
  sendToGrain,
  sendToGrainFromStoredConfig,
  uploadScreenshot,
} from '../lib/grain-client.js'

const MENU_IDS = {
  link: 'send-to-grain-link',
  image: 'send-to-grain-image',
  page: 'send-to-grain-page',
  screenshot: 'send-to-grain-screenshot',
} as const

async function registerContextMenus() {
  await chromeApi.contextMenus.removeAll()
  chromeApi.contextMenus.create({
    id: MENU_IDS.link,
    title: EXTENSION_NAME,
    contexts: ['link'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.image,
    title: 'Send image to Grain',
    contexts: ['image'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.page,
    title: 'Send link to Grain',
    contexts: ['page'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.screenshot,
    title: 'Screenshot page to Grain',
    contexts: ['page'],
  })
}

// Responds to frame-capture requests from the injected screenshot content script.
// captureVisibleTab must run in the service worker, not in a content script.
chromeApi.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
  if (!message || typeof message !== 'object') return
  const msg = message as { type?: string }
  if (msg.type !== 'screenshot:capture-frame') return

  chromeApi.tabs
    .captureVisibleTab(null, { format: 'jpeg', quality: 92 })
    .then((dataUrl) => sendResponse({ type: 'screenshot:frame-data', dataUrl }))
    .catch((err: Error) => sendResponse({ type: 'screenshot:error', error: err.message }))

  return true // keep message channel open for async response
})

async function captureAndSendScreenshot(tabId: number, tabUrl: string | undefined, tabTitle: string | undefined) {
  const [result] = await chromeApi.scripting.executeScript({
    target: { tabId },
    func: async () => {
      // Runs in the content script context — no imports available.
      // Uses chrome.runtime.sendMessage to request each frame from the service worker.

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cr = ((globalThis as any).browser ?? (globalThis as any).chrome) as {
        runtime: {
          sendMessage(
            msg: object,
            callback: (resp: { type: string; dataUrl?: string; error?: string }) => void
          ): void
          lastError?: { message?: string }
        }
      }

      const viewportW = window.innerWidth
      const viewportH = window.innerHeight
      const pageW = Math.max(document.documentElement.scrollWidth, viewportW)
      const pageH = Math.max(document.documentElement.scrollHeight, viewportH)

      function requestCapture(): Promise<string> {
        return new Promise((resolve, reject) => {
          cr.runtime.sendMessage({ type: 'screenshot:capture-frame' }, (resp) => {
            if (cr.runtime.lastError) {
              reject(new Error(cr.runtime.lastError.message ?? 'Capture failed'))
              return
            }
            if (resp.type === 'screenshot:frame-data' && resp.dataUrl) {
              resolve(resp.dataUrl)
            } else {
              reject(new Error(resp.error ?? 'Unexpected capture response'))
            }
          })
        })
      }

      const savedScrollX = window.scrollX
      const savedScrollY = window.scrollY

      // Temporarily convert fixed/sticky elements to absolute so they don't
      // repeat in every captured frame
      const frozen: Array<{ el: HTMLElement; before: string }> = []
      for (const el of document.querySelectorAll<HTMLElement>('*')) {
        const pos = getComputedStyle(el).position
        if (pos === 'fixed' || pos === 'sticky') {
          frozen.push({ el, before: el.style.position })
          el.style.setProperty('position', 'absolute', 'important')
        }
      }

      try {
        // Lazy-load pass: scroll through once to trigger deferred images/content
        for (let y = 0; y < pageH; y += viewportH) {
          window.scrollTo(0, y)
          await new Promise<void>((r) => setTimeout(r, 80))
        }

        // Capture pass: stitch viewport-sized frames onto a full-page canvas
        const canvas = new OffscreenCanvas(pageW, pageH)
        const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

        for (let y = 0; y < pageH; y += viewportH) {
          window.scrollTo(0, y)
          await new Promise<void>((r) => requestAnimationFrame(() => r()))
          await new Promise<void>((r) => setTimeout(r, 40))

          const dataUrl = await requestCapture()
          const imgBlob = await fetch(dataUrl).then((r) => r.blob())
          const bitmap = await createImageBitmap(imgBlob)

          // Last slice may be shorter than a full viewport
          const sliceH = Math.min(viewportH, pageH - y)
          ctx.drawImage(bitmap, 0, 0, viewportW, sliceH, 0, y, viewportW, sliceH)
          bitmap.close()
        }

        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })

        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read screenshot blob'))
          reader.readAsDataURL(blob)
        })
      } finally {
        for (const { el, before } of frozen) {
          el.style.position = before
        }
        window.scrollTo(savedScrollX, savedScrollY)
      }
    },
  })

  const dataUrl = result?.result
  if (!dataUrl) throw new Error('Screenshot returned no data')

  const config = await getStoredConfig()
  if (!config) throw new Error('Connect Grain first')

  const canvasId = await getPrivateCanvasId(config)
  const { url, width, height } = await uploadScreenshot(dataUrl, canvasId, config)

  await sendToGrain(
    {
      sourceChannel: 'extension',
      sourceType: 'image_upload',
      contentKind: 'image',
      originalUrl: tabUrl,
      title: tabTitle,
      previewImageUrl: url,
      metadata: { width, height },
    },
    config
  )
}

async function queueSend(request: SendToGrainRequest) {
  await sendToGrainFromStoredConfig(request)
  await chromeApi.action.setBadgeText({ text: '' })
}

chromeApi.runtime.onInstalled.addListener(() => {
  void registerContextMenus()
})

chromeApi.runtime.onStartup.addListener(() => {
  void registerContextMenus()
})

void registerContextMenus()

chromeApi.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_IDS.page) {
      await queueSend({
        sourceChannel: 'extension',
        sourceType: 'page_url',
        originalUrl: tab?.url,
        title: tab?.title,
      })
      return
    }

    if (info.menuItemId === MENU_IDS.link && typeof info.linkUrl === 'string') {
      await queueSend({
        sourceChannel: 'extension',
        sourceType: 'url',
        originalUrl: info.linkUrl,
      })
      return
    }

    if (info.menuItemId === MENU_IDS.image && typeof info.srcUrl === 'string') {
      await queueSend({
        sourceChannel: 'extension',
        sourceType: 'direct_media_url',
        originalUrl: info.srcUrl,
        contentKind: 'image',
      })
      return
    }

    if (info.menuItemId === MENU_IDS.screenshot && tab?.id) {
      await captureAndSendScreenshot(tab.id, tab.url, tab.title)
    }
  } catch (error) {
    console.error('Send to Grain failed:', error)
    if (error instanceof Error && error.message.includes('Connection expired')) {
      await clearStoredConfig()
    }
    await chromeApi.action.setBadgeBackgroundColor({ color: '#a63f39' })
    await chromeApi.action.setBadgeText({ text: '!' })
  }
})
