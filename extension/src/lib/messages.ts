// 插件内部各部分（content script / background / 侧面板）之间通信用的消息协议。
// 这些是 chrome.runtime.sendMessage / chrome.tabs.sendMessage 传递的消息，
// 跟"求职鸭网页 <-> 插件 content script"之间用 window.postMessage 传递的协议
// （见 pairing.ts 顶部注释）是两码事，不要混。

export interface JdExtractionResult {
  isLikelyJobPosting: boolean;
  company: string;
  title: string;
  jdText: string;
  confidence: "high" | "medium" | "low";
  /** 这次结果是本地选择器精确命中的，还是 AI 从整页正文里猜出来的。 */
  source: "selector" | "ai";
}

export type ExtensionMessage =
  // pairing.ts 收到网页广播的 token 之后，转发给 background 存起来。
  | { type: "PAIRING_TOKEN_RECEIVED"; token: string }
  // 侧面板打开时查一下当前有没有配对成功的 token。
  | { type: "GET_PAIRING_STATUS" }
  // 侧面板点"识别当前页JD"，发给 background，background 再转给当前标签页的 content script。
  | { type: "EXTRACT_JD_ON_ACTIVE_TAB" }
  // content script 直接发给对应标签页的消息（by chrome.tabs.sendMessage），
  // 让它开始识别当前页面。
  | { type: "EXTRACT_JD_IN_TAB" }
  // jd-detect.ts 兜底路径命中不了本地选择器时，把降噪后的正文交给 background
  // 去调用后端 AI 接口。
  | { type: "AI_EXTRACT_JOB_FROM_TEXT"; pageText: string; url: string }
  // 侧面板确认导入后，发给 background 落库。
  | {
      type: "CREATE_JOB";
      payload: { company: string; title: string; jdText: string; url?: string; sourceType?: string };
    };

export type ExtensionResponse =
  | { ok: true; status: "connected"; lastSeenAt: string | null }
  | { ok: true; status: "not_connected" }
  | { ok: true; result: JdExtractionResult }
  | { ok: true; jobId: string; analysisOk: boolean; analysisMessage?: string }
  | { ok: false; message: string };
