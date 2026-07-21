// 求职鸭「浏览器插件」设置页会在加载时用 window.postMessage 广播配对 token
// （见主项目 src/app/(app)/extension/ExtensionPairingClient.tsx），
// 这个 content script 只在 http://localhost:3000/* 下自动注入，负责接收这个
// token 存进插件本地storage，再回一个 ACK 让网页知道"插件真的连上了"。
//
// 协议约定（两边必须完全一致，字符串写死不共享代码，改的时候两边都要改）：
//   页面 -> 插件：{ source: "toudiya-app", type: "TOUDIYA_EXTENSION_TOKEN", token: string }
//   插件 -> 页面：{ source: "toudiya-app", type: "TOUDIYA_EXTENSION_ACK" }

const MESSAGE_SOURCE = "toudiya-app";
const MSG_TOKEN = "TOUDIYA_EXTENSION_TOKEN";
const MSG_ACK = "TOUDIYA_EXTENSION_ACK";

interface PairingMessageData {
  source?: string;
  type?: string;
  token?: string;
}

window.addEventListener("message", (event: MessageEvent<PairingMessageData>) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  if (event.data?.source !== MESSAGE_SOURCE) return;
  if (event.data?.type !== MSG_TOKEN || !event.data.token) return;

  chrome.runtime
    .sendMessage({ type: "PAIRING_TOKEN_RECEIVED", token: event.data.token })
    .then(() => {
      window.postMessage({ source: MESSAGE_SOURCE, type: MSG_ACK }, window.location.origin);
    })
    .catch((error) => {
      console.error("[toudiya-extension] 配对失败：", error);
    });
});
