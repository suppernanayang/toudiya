import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { verifyExtensionToken } from "@/lib/extension-auth";
import { runJobAnalysis } from "@/app/(app)/jobs/actions";

/**
 * 浏览器插件"一键导入JD"确认后调用的接口。
 * 插件已经在侧面板里让用户看过、改过公司/岗位/JD正文，这里收到的是
 * 用户确认过的最终内容，直接落库（复用岗位池现有的建岗位+触发分析逻辑），
 * 不再做任何静默的自动判断。
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

  const { company, title, jdText, url, sourceType } = (body || {}) as Record<string, unknown>;
  const companyStr = typeof company === "string" ? company.trim() : "";
  const titleStr = typeof title === "string" ? title.trim() : "";
  const jdTextStr = typeof jdText === "string" ? jdText.trim() : "";
  const urlStr = typeof url === "string" ? url.trim() : "";
  const sourceTypeStr =
    typeof sourceType === "string" && ["job_platform", "company_website", "url"].includes(sourceType)
      ? sourceType
      : "job_platform";

  if (!companyStr || !titleStr) {
    return NextResponse.json({ ok: false, message: "公司和岗位名称不能为空。" }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      userId: DEFAULT_USER_ID,
      company: companyStr,
      title: titleStr,
      sourceType: sourceTypeStr,
      sourceName: "browser_extension",
      url: urlStr || null,
      jdRawText: jdTextStr || null,
      status: "imported",
    },
  });

  if (!jdTextStr) {
    return NextResponse.json({ ok: true, jobId: job.id, analysisOk: false, analysisMessage: "没有JD正文，跳过分析。" });
  }

  const analysis = await runJobAnalysis(job.id);
  return NextResponse.json({
    ok: true,
    jobId: job.id,
    analysisOk: analysis.ok,
    analysisMessage: analysis.message,
  });
}
