import { chromeApi } from './chrome-api.js'
import {
  CONFIG_STORAGE_KEY,
  type SendToGrainConfig,
  type SendToGrainPage,
  type SendToGrainRequest,
  type SendToGrainResponse,
} from './index.js'

export interface GrainClientOptions {
  baseUrl: string
  accessToken?: string | null
}

interface PersistedConfigMap {
  [CONFIG_STORAGE_KEY]?: SendToGrainConfig
}

export async function getStoredConfig(): Promise<SendToGrainConfig | null> {
  const result = await chromeApi.storage.local.get<PersistedConfigMap>(CONFIG_STORAGE_KEY)
  return result[CONFIG_STORAGE_KEY] ?? null
}

export async function saveStoredConfig(config: SendToGrainConfig): Promise<void> {
  await chromeApi.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
}

export async function updateStoredConfig(
  update: Partial<SendToGrainConfig>
): Promise<SendToGrainConfig | null> {
  const current = await getStoredConfig()
  if (!current) return null

  const next = { ...current, ...update }
  await saveStoredConfig(next)
  return next
}

export async function clearStoredConfig(): Promise<void> {
  await chromeApi.storage.local.remove(CONFIG_STORAGE_KEY)
}

export async function connectFromActiveGrainTab(tabId: number): Promise<SendToGrainConfig> {
  const existingConfig = await getStoredConfig()
  const [result] = await chromeApi.scripting.executeScript({
    target: { tabId },
    func: () => {
      const baseUrl = location.origin

      const findTokenFromStorage = (storage: Storage) => {
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i)
          if (!key) continue
          if (!key.includes('auth-token')) continue

          const rawValue = storage.getItem(key)
          if (!rawValue) continue

          try {
            const parsed = JSON.parse(rawValue) as { access_token?: string }
            if (parsed?.access_token) {
              return parsed.access_token
            }
          } catch {}
        }
        return null
      }

      const accessToken = findTokenFromStorage(localStorage) || findTokenFromStorage(sessionStorage)

      return {
        baseUrl,
        accessToken,
      }
    },
  })

  const data = result?.result
  if (!data || typeof data !== 'object') {
    throw new Error('Failed to read Grain connection data from the active tab')
  }

  const baseUrl = (data as { baseUrl?: unknown }).baseUrl
  const accessToken = (data as { accessToken?: unknown }).accessToken

  if (typeof baseUrl !== 'string' || !baseUrl) {
    throw new Error('Could not determine the Grain base URL')
  }
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('Could not find a Supabase access token on the active Grain tab')
  }

  const config: SendToGrainConfig = {
    baseUrl,
    accessToken,
    connectedAt: new Date().toISOString(),
    targetPageId: existingConfig?.baseUrl === baseUrl ? existingConfig.targetPageId ?? null : null,
    targetPageName: existingConfig?.baseUrl === baseUrl ? existingConfig.targetPageName ?? null : null,
  }

  await saveStoredConfig(config)
  return config
}

export async function sendToGrain(
  request: SendToGrainRequest,
  options: GrainClientOptions
): Promise<SendToGrainResponse> {
  const response = await fetch(`${options.baseUrl}/api/send-to-grain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 || response.status === 403) {
      throw new Error('Connection expired. Reconnect from a signed-in Grain tab.')
    }
    throw new Error(data.error || 'Failed to send to Grain')
  }

  return (await response.json()) as SendToGrainResponse
}

function applyStoredTargetPage(
  request: SendToGrainRequest,
  config: SendToGrainConfig
): SendToGrainRequest {
  if (!config.targetPageId) return request

  return {
    ...request,
    targetPageId: request.targetPageId ?? config.targetPageId,
    targetPageName: request.targetPageName ?? config.targetPageName ?? null,
  }
}

export async function sendToGrainFromStoredConfig(request: SendToGrainRequest) {
  const config = await getStoredConfig()
  if (!config) {
    throw new Error('Connect Grain first')
  }

  try {
    return await sendToGrain(applyStoredTargetPage(request, config), config)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Connection expired')
    ) {
      await clearStoredConfig()
    }
    throw error
  }
}

export async function listSendToGrainPages(options: GrainClientOptions): Promise<SendToGrainPage[]> {
  const response = await fetch(`${options.baseUrl}/api/send-to-grain/pages`, {
    headers: {
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 || response.status === 403) {
      throw new Error('Connection expired. Reconnect from a signed-in Grain tab.')
    }
    throw new Error(data.error || 'Failed to load pages')
  }

  const data = (await response.json()) as { pages?: SendToGrainPage[] }
  return data.pages ?? []
}

export async function listSendToGrainPagesFromStoredConfig() {
  const config = await getStoredConfig()
  if (!config) {
    throw new Error('Connect Grain first')
  }

  try {
    return await listSendToGrainPages(config)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Connection expired')
    ) {
      await clearStoredConfig()
    }
    throw error
  }
}

export async function createSendToGrainPage(
  name: string,
  options: GrainClientOptions
): Promise<SendToGrainPage> {
  const response = await fetch(`${options.baseUrl}/api/send-to-grain/pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 || response.status === 403) {
      throw new Error('Connection expired. Reconnect from a signed-in Grain tab.')
    }
    throw new Error(data.error || 'Failed to create page')
  }

  const data = (await response.json()) as { page?: SendToGrainPage }
  if (!data.page) {
    throw new Error('Failed to create page')
  }

  return data.page
}

export async function createSendToGrainPageFromStoredConfig(name: string) {
  const config = await getStoredConfig()
  if (!config) {
    throw new Error('Connect Grain first')
  }

  try {
    return await createSendToGrainPage(name, config)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Connection expired')
    ) {
      await clearStoredConfig()
    }
    throw error
  }
}
