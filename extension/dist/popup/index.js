import { chromeApi } from '../lib/chrome-api.js';
import { clearStoredConfig, connectFromActiveGrainTab, getStoredConfig, sendToGrainFromStoredConfig, } from '../lib/grain-client.js';
const STATUS_COLORS = {
    neutral: { text: '#5f574d', background: 'rgba(95, 87, 77, 0.08)' },
    success: { text: '#1f6a47', background: 'rgba(47, 111, 87, 0.14)' },
    error: { text: '#9b2f2f', background: 'rgba(166, 63, 57, 0.14)' },
};
function formatConnectedLabel(baseUrl) {
    return baseUrl.replace(/^https?:\/\//, '');
}
function isConnectableUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function setStatus(element, message, tone = 'neutral') {
    if (!element)
        return;
    element.textContent = message;
    element.style.color = STATUS_COLORS[tone].text;
    element.style.background = STATUS_COLORS[tone].background;
    element.style.fontWeight = tone === 'neutral' ? '500' : '600';
}
export function mountPopup(root) {
    const status = root.querySelector('[data-status]');
    const connectionState = root.querySelector('[data-connection-state]');
    const connectButton = root.querySelector('[data-action="connect"]');
    const sendButton = root.querySelector('[data-action="current-page"]');
    const disconnectButton = root.querySelector('[data-action="disconnect"]');
    const refresh = async () => {
        const config = await getStoredConfig();
        if (connectionState) {
            connectionState.textContent = config ? `Connected to ${formatConnectedLabel(config.baseUrl)}` : 'Not connected';
        }
        if (sendButton) {
            sendButton.disabled = !config;
            sendButton.style.opacity = config ? '1' : '.55';
            sendButton.style.cursor = config ? 'pointer' : 'not-allowed';
        }
    };
    connectButton?.addEventListener('click', async () => {
        try {
            const [activeTab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
            if (!activeTab?.id || !activeTab.url) {
                throw new Error('Open Grain in the active tab first');
            }
            if (!isConnectableUrl(activeTab.url)) {
                throw new Error('Connect from a normal Grain tab, not a browser internal page');
            }
            const config = await connectFromActiveGrainTab(activeTab.id);
            setStatus(status, `Connected to ${formatConnectedLabel(config.baseUrl)}.`, 'success');
            await refresh();
        }
        catch (error) {
            setStatus(status, error instanceof Error ? error.message : 'Failed to connect', 'error');
            await refresh();
        }
    });
    sendButton?.addEventListener('click', async () => {
        try {
            const [activeTab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
            const request = {
                sourceChannel: 'extension',
                sourceType: 'page_url',
                originalUrl: activeTab?.url,
                title: activeTab?.title,
            };
            await sendToGrainFromStoredConfig(request);
            setStatus(status, 'Sent current page to Grain.', 'success');
        }
        catch (error) {
            setStatus(status, error instanceof Error ? error.message : 'Failed to send current page', 'error');
            await refresh();
        }
    });
    disconnectButton?.addEventListener('click', async () => {
        await clearStoredConfig();
        setStatus(status, 'Connection cleared.', 'neutral');
        await refresh();
    });
    void refresh();
}
const root = document.getElementById('root');
if (root) {
    mountPopup(root);
}
