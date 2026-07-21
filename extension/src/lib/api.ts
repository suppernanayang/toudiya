import { TOUDIYA_APP_ORIGIN, EXTENSION_TOKEN_HEADER, getStoredToken } from "./storage";
import type { JdExtractionResult } from "./messages";

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("插件还没有跟求职鸭配对，请先打开求职鸭的「浏览器插件」设置页完成连接。");
  }
  return fetch(`${TOUDIYA_APP_ORIGIN}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      [EXTENSION_TOKEN_HEADER]: token,
    },
  });
}

export async function fetchPairingStatus(): Promise<{ connected: boolean; lastSeenAt: string | null }> {
  const token = await getStoredToken();
  if (!token) return { connected: false, lastSeenAt: null };

  try {
    const res = await authorizedFetch("/api/extension/profile");
    if (!res.ok) return { connected: false, lastSeenAt: null };
    return { connected: true, lastSeenAt: null };
  } catch {
    return { connected: false, lastSeenAt: null };
  }
}

export async function extractJobFromPageText(input: {
  pageText: string;
  url: string;
}): Promise<JdExtractionResult> {
  const res = await authorizedFetch("/api/extension/extract-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.message || "识别失败");
  }
  return { ...data.result, source: "ai" };
}

export async function createJob(payload: {
  company: string;
  title: string;
  jdText: string;
  url?: string;
  sourceType?: string;
}): Promise<{ jobId: string; analysisOk: boolean; analysisMessage?: string }> {
  const res = await authorizedFetch("/api/extension/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.message || "导入失败");
  }
  return { jobId: data.jobId, analysisOk: data.analysisOk, analysisMessage: data.analysisMessage };
}
