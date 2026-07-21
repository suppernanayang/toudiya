import { setStoredToken, getStoredToken } from "../lib/storage";
import { extractJobFromPageText, createJob, fetchPairingStatus } from "../lib/api";
import type { ExtensionMessage, ExtensionResponse } from "../lib/messages";

// 打开插件图标直接弹出侧面板，不需要额外弹一个 popup 再跳转。
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error("[toudiya] 设置侧面板行为失败：", error);
  });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ ok: false, message: error instanceof Error ? error.message : "未知错误" } satisfies ExtensionResponse);
    });
  // 返回 true 表示这是一个异步响应，chrome 会等 sendResponse 真正被调用。
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.type) {
    case "PAIRING_TOKEN_RECEIVED": {
      await setStoredToken(message.token);
      return { ok: true, status: "connected", lastSeenAt: new Date().toISOString() };
    }

    case "GET_PAIRING_STATUS": {
      const token = await getStoredToken();
      if (!token) return { ok: true, status: "not_connected" };
      const status = await fetchPairingStatus();
      return status.connected
        ? { ok: true, status: "connected", lastSeenAt: status.lastSeenAt }
        : { ok: true, status: "not_connected" };
    }

    case "EXTRACT_JD_ON_ACTIVE_TAB": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        return { ok: false, message: "找不到当前标签页。" };
      }
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JD_IN_TAB" } satisfies ExtensionMessage);
        return result as ExtensionResponse;
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : String(error);
        // 这个报错是 Chrome 的通用提示，真正原因几乎总是"这个页面是在装/更新插件之前
        // 就已经打开的，浏览器没有给旧标签页注入新脚本"——刷新一下页面就好了，
        // 不是插件本身坏了，翻译成人话，别让用户对着一句英文 API 报错发愁。
        if (rawMessage.includes("Receiving end does not exist") || rawMessage.includes("Could not establish connection")) {
          return {
            ok: false,
            message:
              "这个页面是在你安装/更新插件之前就打开的，浏览器还没给它注入最新的插件脚本。刷新一下这个页面（F5），再点一次试试。",
          };
        }
        return { ok: false, message: rawMessage };
      }
    }

    case "AI_EXTRACT_JOB_FROM_TEXT": {
      const result = await extractJobFromPageText({ pageText: message.pageText, url: message.url });
      return { ok: true, result };
    }

    case "CREATE_JOB": {
      const result = await createJob(message.payload);
      return { ok: true, ...result };
    }

    default:
      return { ok: false, message: `未知的消息类型：${JSON.stringify(message)}` };
  }
}
