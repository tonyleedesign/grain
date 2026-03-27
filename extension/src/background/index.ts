import { chromeApi } from '../lib/chrome-api.js'
import { EXTENSION_NAME, type SendToGrainRequest } from '../lib/index.js'
import { clearStoredConfig, sendToGrainFromStoredConfig } from '../lib/grain-client.js'

const MENU_IDS = {
  link: 'send-to-grain-link',
  image: 'send-to-grain-image',
  page: 'send-to-grain-page',
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
    title: EXTENSION_NAME,
    contexts: ['page'],
  })
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
