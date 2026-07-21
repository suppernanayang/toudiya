import { NextRequest, NextResponse } from "next/server";
import { verifyExtensionToken } from "@/lib/extension-auth";
import { extractJobFromPageText } from "@/lib/llm";

/**
 * 插件在没有命中已知平台选择器规则时的兜底路径：
 * 插件已经用 defuddle 之类的工具把整页降噪成干净正文，这里只负责调用 AI
 * 从这段正文里识别出 company/title/jdText，交给插件侧面板给用户预览确认，
 * 不做任何数据库写入（写入要等用户在侧面板确认之后调 /api/extension/jobs）。
 */
export async function POST(request: NextRequest) {
  const authorized = await verifyExtensionToken(request);
  if (!authorized) {
    return NextResponse.json({ ok: false, message: "插件未配对或配对码不正确，请先去「浏览器插件」设置页重新连接。" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求体不是合法的 JSON。" }, { status: 400 });
  }

  const { pageText, url } = (body || {}) as Record<string, unknown>;
  const pageTextStr = typeof pageText === "string" ? pageText.trim() : "";
  const urlStr = typeof url === "string" ? url.trim() : "";

  if (!pageTextStr) {
    return NextResponse.json({ ok: false, message: "网页正文是空的，没有可识别的内容。" }, { status: 400 });
  }

  try {
    const { envelope } = await extractJobFromPageText({ pageText: pageTextStr, url: urlStr });
    return NextResponse.json({ ok: true, result: envelope.result });
  } catch (error) {
    console.error("[extension] JD 提取失败：", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "识别失败，未知错误" },
      { status: 500 },
    );
  }
}
