"use server";

import path from "path";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { saveExportFile } from "@/lib/storage";
import { generateResumePdf } from "@/lib/resume-pdf/generate";

export type ExportPdfResult = { ok: true; downloadUrl: string } | { ok: false; message: string };

export async function exportResumeVersionPdf(versionId: string): Promise<ExportPdfResult> {
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

  const result = await generateResumePdf({
    name: user?.name || "",
    targetRole: version.resumeSource?.targetRoleType || null,
    city: targetCities[0] || null,
    email: user?.email || null,
    phone: user?.phone || null,
    avatarAbsolutePath: user?.avatarPath ? path.join(process.cwd(), user.avatarPath) : null,
    contentText: version.contentText,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: `${result.reason}（建议去审核台把这份简历的正文按"## 分区标题" + "机构 | 时间" + "- 要点"的格式整理一下再导出）`,
    };
  }

  const saved = await saveExportFile({
    userId: DEFAULT_USER_ID,
    versionId: version.id,
    ext: "pdf",
    content: result.buffer,
  });

  return { ok: true, downloadUrl: `/api/files/${encodeURIComponent(saved.relativePath)}` };
}
