import { chromeApi } from '../lib/chrome-api.js'
import { EXTENSION_NAME, type SendToGrainRequest } from '../lib/index.js'
import {
  clearStoredConfig,
  sendToGrainFromStoredConfig,
} from '../lib/grain-client.js'
import { captureAndSendScreenshot } from '../lib/screenshot/index.js'
import type { ScreenshotMode } from '../lib/screenshot/types.js'

const MENU_IDS = {
  root: 'send-to-grain-root',
  link: 'send-to-grain-link',
  image: 'send-to-grain-image',
  page: 'send-to-grain-page',
  screenshotRoot: 'send-to-grain-screenshot-root',
  screenshotViewport: 'send-to-grain-screenshot-viewport',
  screenshotFullPage: 'send-to-grain-screenshot-full-page',
  screenshotElement: 'send-to-grain-screenshot-element',
} as const

async function registerContextMenus() {
  await chromeApi.contextMenus.removeAll()

  chromeApi.contextMenus.create({
    id: MENU_IDS.root,
    title: EXTENSION_NAME,
    contexts: ['page', 'link', 'image'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.link,
    parentId: MENU_IDS.root,
    title: 'Send link to Grain',
    contexts: ['link'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.image,
    parentId: MENU_IDS.root,
    title: 'Send image to Grain',
    contexts: ['image'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.page,
    parentId: MENU_IDS.root,
    title: 'Send link to Grain',
    contexts: ['page'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.screenshotRoot,
    parentId: MENU_IDS.root,
    title: 'Screenshot',
    contexts: ['page'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.screenshotViewport,
    parentId: MENU_IDS.screenshotRoot,
    title: 'Viewport',
    contexts: ['page'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.screenshotFullPage,
    parentId: MENU_IDS.screenshotRoot,
    title: 'Full page',
    contexts: ['page'],
  })

  chromeApi.contextMenus.create({
    id: MENU_IDS.screenshotElement,
    parentId: MENU_IDS.screenshotRoot,
    title: 'Select element',
    contexts: ['page'],
  })
}

// Full-page capture requests each visible frame from the service worker because
// captureVisibleTab is not available inside the injected page script.
chromeApi.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
  if (!message || typeof message !== 'object') return
  const msg = message as { type?: string }
  if (msg.type !== 'screenshot:capture-frame') return

  chromeApi.tabs
    .captureVisibleTab(null, { format: 'jpeg', quality: 92 })
    .then((dataUrl) => sendResponse({ type: 'screenshot:frame-data', dataUrl }))
    .catch((err: Error) => sendResponse({ type: 'screenshot:error', error: err.message }))

  return true
})

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
    const screenshotModes: Partial<Record<string, ScreenshotMode>> = {
      [MENU_IDS.screenshotViewport]: 'viewport',
      [MENU_IDS.screenshotFullPage]: 'full_page',
      [MENU_IDS.screenshotElement]: 'element',
    }

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

    const screenshotMode = screenshotModes[info.menuItemId]
    if (screenshotMode && tab?.id) {
      await captureAndSendScreenshot(tab.id, tab.url, tab.title, screenshotMode)
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
