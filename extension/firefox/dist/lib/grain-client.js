import { chromeApi } from './chrome-api.js';
import { CONFIG_STORAGE_KEY, } from './index.js';
export async function getStoredConfig() {
    const result = await chromeApi.storage.local.get(CONFIG_STORAGE_KEY);
    return result[CONFIG_STORAGE_KEY] ?? null;
}
export async function saveStoredConfig(config) {
    await chromeApi.storage.local.set({ [CONFIG_STORAGE_KEY]: config });
}
export async function updateStoredConfig(update) {
    const current = await getStoredConfig();
    if (!current)
        return null;
    const next = { ...current, ...update };
    await saveStoredConfig(next);
    return next;
}
export async function clearStoredConfig() {
    await chromeApi.storage.local.remove(CONFIG_STORAGE_KEY);
}
export async function connectFromActiveGrainTab(tabId) {
    const existingConfig = await getStoredConfig();
    const [result] = await chromeApi.scripting.executeScript({
        target: { tabId },
        func: () => {
            const baseUrl = location.origin;
            const findTokenFromStorage = (storage) => {
                for (let i = 0; i < storage.length; i += 1) {
                    const key = storage.key(i);
                    if (!key)
                        continue;
                    if (!key.includes('auth-token'))
                        continue;
                    const rawValue = storage.getItem(key);
                    if (!rawValue)
                        continue;
                    try {
                        const parsed = JSON.parse(rawValue);
                        if (parsed?.access_token) {
                            return parsed.access_token;
                        }
                    }
                    catch { }
                }
                return null;
            };
            const accessToken = findTokenFromStorage(localStorage) || findTokenFromStorage(sessionStorage);
            return {
                baseUrl,
                accessToken,
            };
        },
    });
    const data = result?.result;
    if (!data || typeof data !== 'object') {
        throw new Error('Failed to read Grain connection data from the active tab');
    }
    const baseUrl = data.baseUrl;
    const accessToken = data.accessToken;
    if (typeof baseUrl !== 'string' || !baseUrl) {
        throw new Error('Could not determine the Grain base URL');
    }
    if (typeof accessToken !== 'string' || !accessToken) {
        throw new Error('Could not find a Supabase access token on the active Grain tab');
    }
    const config = {
        baseUrl,
        accessToken,
        connectedAt: new Date().toISOString(),
        targetPageId: existingConfig?.baseUrl === baseUrl ? existingConfig.targetPageId ?? null : null,
        targetPageName: existingConfig?.baseUrl === baseUrl ? existingConfig.targetPageName ?? null : null,
    };
    await saveStoredConfig(config);
    return config;
}
export async function sendToGrain(request, options) {
    const response = await fetch(`${options.baseUrl}/api/send-to-grain`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        },
        body: JSON.stringify(request),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
            throw new Error('Connection expired. Reconnect from a signed-in Grain tab.');
        }
        throw new Error(data.error || 'Failed to send to Grain');
    }
    return (await response.json());
}
function applyStoredTargetPage(request, config) {
    if (!config.targetPageId)
        return request;
    return {
        ...request,
        targetPageId: request.targetPageId ?? config.targetPageId,
        targetPageName: request.targetPageName ?? config.targetPageName ?? null,
    };
}
export async function sendToGrainFromStoredConfig(request) {
    const config = await getStoredConfig();
    if (!config) {
        throw new Error('Connect Grain first');
    }
    try {
        return await sendToGrain(applyStoredTargetPage(request, config), config);
    }
    catch (error) {
        if (error instanceof Error &&
            error.message.includes('Connection expired')) {
            await clearStoredConfig();
        }
        throw error;
    }
}
export async function listSendToGrainPages(options) {
    const response = await fetch(`${options.baseUrl}/api/send-to-grain/pages`, {
        headers: {
            ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        },
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
            throw new Error('Connection expired. Reconnect from a signed-in Grain tab.');
        }
        throw new Error(data.error || 'Failed to load pages');
    }
    const data = (await response.json());
    return data.pages ?? [];
}
export async function listSendToGrainPagesFromStoredConfig() {
    const config = await getStoredConfig();
    if (!config) {
        throw new Error('Connect Grain first');
    }
    try {
        return await listSendToGrainPages(config);
    }
    catch (error) {
        if (error instanceof Error &&
            error.message.includes('Connection expired')) {
            await clearStoredConfig();
        }
        throw error;
    }
}
export async function createSendToGrainPage(name, options) {
    const response = await fetch(`${options.baseUrl}/api/send-to-grain/pages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
            throw new Error('Connection expired. Reconnect from a signed-in Grain tab.');
        }
        throw new Error(data.error || 'Failed to create page');
    }
    const data = (await response.json());
    if (!data.page) {
        throw new Error('Failed to create page');
    }
    return data.page;
}
export async function createSendToGrainPageFromStoredConfig(name) {
    const config = await getStoredConfig();
    if (!config) {
        throw new Error('Connect Grain first');
    }
    try {
        return await createSendToGrainPage(name, config);
    }
    catch (error) {
        if (error instanceof Error &&
            error.message.includes('Connection expired')) {
            await clearStoredConfig();
        }
        throw error;
    }
}
