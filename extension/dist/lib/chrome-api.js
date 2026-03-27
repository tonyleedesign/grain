const runtimeApi = globalThis.browser ??
    globalThis.chrome;
if (!runtimeApi) {
    throw new Error('Browser extension APIs are unavailable in this environment');
}
export const chromeApi = runtimeApi;
