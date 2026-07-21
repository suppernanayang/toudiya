// 求职鸭本地服务的地址。以后如果支持自定义端口/远程部署，这里可以改成从
// chrome.storage.local 读用户自己填的地址，现在先写死本机默认端口。
export const TOUDIYA_APP_ORIGIN = "http://localhost:3000";

export const EXTENSION_TOKEN_HEADER = "x-toudiya-extension-token";

const STORAGE_KEY_TOKEN = "toudiyaExtensionToken";

export async function getStoredToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY_TOKEN);
  return (result[STORAGE_KEY_TOKEN] as string | undefined) ?? null;
}

export async function setStoredToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: token });
}
