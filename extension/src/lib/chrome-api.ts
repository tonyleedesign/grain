export interface ChromeTab {
  id?: number
  url?: string
  title?: string
}

export interface ChromeRuntimeAPI {
  onInstalled: {
    addListener(callback: () => void): void
  }
  onStartup: {
    addListener(callback: () => void): void
  }
}

export interface ChromeContextMenusAPI {
  removeAll(callback?: () => void): Promise<void> | void
  create(options: { id: string; title: string; contexts: string[]; parentId?: string }): void
  onClicked: {
    addListener(
      callback: (
        info: {
          menuItemId: string
          linkUrl?: string
          srcUrl?: string
        },
        tab?: ChromeTab
      ) => void | Promise<void>
    ): void
  }
}

export interface ChromeTabsAPI {
  query(options: { active?: boolean; currentWindow?: boolean }): Promise<ChromeTab[]>
}

export interface ChromeScriptingAPI {
  executeScript<T = unknown>(options: {
    target: { tabId: number }
    func: (...args: never[]) => T
  }): Promise<Array<{ result?: T }>>
}

export interface ChromeStorageArea {
  get<T = Record<string, unknown>>(keys?: string | string[] | null): Promise<T>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
}

export interface ChromeStorageAPI {
  local: ChromeStorageArea
}

export interface ChromeActionAPI {
  setBadgeText(options: { text?: string }): Promise<void> | void
  setBadgeBackgroundColor(options: { color: string }): Promise<void> | void
}

export interface ChromeApi {
  runtime: ChromeRuntimeAPI
  contextMenus: ChromeContextMenusAPI
  tabs: ChromeTabsAPI
  scripting: ChromeScriptingAPI
  storage: ChromeStorageAPI
  action: ChromeActionAPI
}

declare const chrome: ChromeApi | undefined
declare const browser: ChromeApi | undefined

const runtimeApi = (
  globalThis as typeof globalThis & {
    browser?: ChromeApi
    chrome?: ChromeApi
  }
).browser ??
  (
    globalThis as typeof globalThis & {
      browser?: ChromeApi
      chrome?: ChromeApi
    }
  ).chrome

if (!runtimeApi) {
  throw new Error('Browser extension APIs are unavailable in this environment')
}

export const chromeApi = runtimeApi
