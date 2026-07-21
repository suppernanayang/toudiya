"use server";

import path from "path";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { saveExportFile } from "@/lib/storage";
import { generateResumePdf, type GenerateResumePdfInput } from "@/lib/resume-pdf/generate";

export type ExportPdfResult =
  | { ok: true; downloadUrl: string; warning?: string }
  | { ok: false; message: string };

async function loadResumePdfInput(
  versionId: string,
): Promise<{ ok: true; input: GenerateResumePdfInput } | { ok: false; message: string }> {
  const [version, user] = await Promise.all([
    prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resumeSource: true },
    }),
    prisma.user.findUnique({ where: { id: DEFAULT_USER_ID }, include: { profile: true } }),
  ]);

  if (!version) return { ok: false, message: "找不到这份简历版本。" };
  if (!version.contentText || !version.contentText.trim()) {
    return { ok: false, message: "这份简历版本还没有正文内容，无法导出 PDF。" };
  }

  const targetCities = (user?.profile?.targetCities as string[] | null) || [];

  return {
    ok: true,
    input: {
      name: user?.name || "",
      targetRole: version.resumeSource?.targetRoleType || null,
      city: targetCities[0] || null,
      email: user?.email || null,
      phone: user?.phone || null,
      avatarAbsolutePath: user?.avatarPath ? path.join(process.cwd(), user.avatarPath) : null,
      contentText: version.contentText,
    },
  };
}

/**
 * 导出 PDF。
 * - 不传 scale：走"自动缩到 1 页"的默认逻辑（内容超过 1 页会自动缩小字号重试）。
 * - 传了 scale：说明用户已经在预览里手动调过字号并确认，直接按这个系数渲染一次，
 *   保证导出结果跟预览里看到的一致，不再自动调整。
 */
export async function exportResumeVersionPdf(versionId: string, scale?: number): Promise<ExportPdfResult> {
  const loaded = await loadResumePdfInput(versionId);
  if (!loaded.ok) return loaded;

  const result = await generateResumePdf({ ...loaded.input, scale });

  if (!result.ok) {
    return {
      ok: false,
      message: `${result.reason}（建议去审核台把这份简历的正文按"## 分区标题" + "机构 | 时间" + "- 要点"的格式整理一下再导出）`,
    };
  }

  const saved = await saveExportFile({
    userId: DEFAULT_USER_ID,
    versionId,
    ext: "pdf",
    content: result.buffer,
  });

  return { ok: true, downloadUrl: `/api/files/${encodeURIComponent(saved.relativePath)}`, warning: result.warning };
}

export interface ResumePdfPreviewData {
  name: string;
  subtitle?: string;
  contactLine?: string;
  avatarUrl?: string;
  contentText: string;
}

export type ResumePdfPreviewResult =
  | { ok: true; data: ResumePdfPreviewData }
  | { ok: false; message: string };

/**
 * 给"导出前预览"用的：把渲染 PDF 需要的数据原样交给客户端，
 * 客户端拿这些数据自己拼出跟服务端一样的 <ResumeDocument>，用 react-pdf 自带的
 * PDFViewer 实时渲染，用户调字号滑块时不需要每次都请求服务端。
 */
export async function getResumePdfPreviewData(versionId: string): Promise<ResumePdfPreviewResult> {
  const [version, user] = await Promise.all([
    prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resumeSource: true },
    }),
    prisma.user.findUnique({ where: { id: DEFAULT_USER_ID }, include: { profile: true } }),
  ]);

  if (!version) return { ok: false, message: "找不到这份简历版本。" };
  if (!version.contentText || !version.contentText.trim()) {
    return { ok: false, message: "这份简历版本还没有正文内容，无法预览。" };
  }

  const targetCities = (user?.profile?.targetCities as string[] | null) || [];
  const contactParts = [user?.phone, user?.email].filter(Boolean);
  const subtitleParts = [version.resumeSource?.targetRoleType, targetCities[0]].filter(Boolean);

  return {
    ok: true,
    data: {
      name: user?.name || "未填写姓名",
      subtitle: subtitleParts.join(" · ") || undefined,
      contactLine: contactParts.join("  ·  ") || undefined,
      avatarUrl: user?.avatarPath ? `/api/files/${encodeURIComponent(user.avatarPath)}` : undefined,
      contentText: version.contentText,
    },
  };
}
