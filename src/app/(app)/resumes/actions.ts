"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { saveResumeFile } from "@/lib/storage";
import { parseResumeFile } from "@/lib/document-parser";
import { extractResumeExperience } from "@/lib/llm";
import { saveExtractedExperienceItem } from "@/lib/experience";

type ActionResult = { ok: true } | { ok: false; message: string };

export async function updatePersonalInfo(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!name) {
    return { ok: false, message: "姓名不能为空，PDF 简历抬头需要用到它。" };
  }

  await prisma.user.update({
    where: { id: DEFAULT_USER_ID },
    data: {
      name,
      email: email || null,
      phone: phone || null,
    },
  });

  revalidatePath("/resumes");
  return { ok: true };
}

async function extractAndSaveExperience(resumeSourceId: string, resumeText: string) {
  if (!resumeText.trim()) return { ok: true as const };
  try {
    const { envelope } = await extractResumeExperience(resumeText);
    let created = 0;
    let skippedDuplicate = 0;
    let flaggedUpdate = 0;
    for (const item of envelope.result) {
      const outcome = await saveExtractedExperienceItem(resumeSourceId, item);
      if (outcome === "created") created += 1;
      else if (outcome === "skipped_duplicate") skippedDuplicate += 1;
      else flaggedUpdate += 1;
    }
    console.log(
      `[resumes] 经历提取完成：新增 ${created} 条，跳过完全重复 ${skippedDuplicate} 条，标记待确认更新 ${flaggedUpdate} 条`,
    );
    return { ok: true as const };
  } catch (error) {
    console.error("[resumes] 经历提取失败：", error);
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "经历提取失败，未知错误",
    };
  }
}

async function unsetOtherDefaults(targetRoleType: string | null, exceptId?: string) {
  if (!targetRoleType) return;
  await prisma.resumeSource.updateMany({
    where: {
      userId: DEFAULT_USER_ID,
      targetRoleType,
      isDefault: true,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { isDefault: false },
  });
}

export async function createResumeFromText(formData: FormData) {
  const name = String(formData.get("name") || "").trim() || "未命名简历";
  const targetRoleType = String(formData.get("targetRoleType") || "").trim() || null;
  const setAsDefault = formData.get("setAsDefault") === "on";
  const resumeText = String(formData.get("resumeText") || "").trim();

  if (!resumeText) {
    redirect(`/resumes?warning=${encodeURIComponent("简历内容不能为空，请粘贴文本后再提交。")}`);
  }

  const resumeSource = await prisma.resumeSource.create({
    data: {
      userId: DEFAULT_USER_ID,
      name,
      sourceType: "original_upload",
      targetRoleType,
      tags: targetRoleType ? [targetRoleType] : [],
      parsedText: resumeText,
      isDefault: setAsDefault,
    },
  });

  if (setAsDefault) await unsetOtherDefaults(targetRoleType, resumeSource.id);

  const versionId = randomUUID();
  const saved = await saveResumeFile({
    folder: "originals",
    userId: DEFAULT_USER_ID,
    versionId,
    versionType: "original",
    ext: "txt",
    content: resumeText,
  });

  await prisma.resumeVersion.create({
    data: {
      id: versionId,
      userId: DEFAULT_USER_ID,
      resumeSourceId: resumeSource.id,
      versionName: `${name} · 原始版`,
      versionType: "original",
      status: "candidate",
      filePath: saved.relativePath,
      fileFormat: "txt",
      contentText: resumeText,
      createdBy: "user",
    },
  });

  const extraction = await extractAndSaveExperience(resumeSource.id, resumeText);

  const warning = extraction.ok
    ? undefined
    : `简历已保存，但经历提取失败：${extraction.message}`;

  redirect(`/resumes${warning ? `?warning=${encodeURIComponent(warning)}` : "?success=1"}`);
}

export async function uploadResumeFile(formData: FormData) {
  const name = String(formData.get("name") || "").trim() || "未命名简历";
  const targetRoleType = String(formData.get("targetRoleType") || "").trim() || null;
  const setAsDefault = formData.get("setAsDefault") === "on";
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/resumes?warning=${encodeURIComponent("请先选择要上传的 PDF / Word 文件。")}`);
  }

  const uploadedFile = file as File;
  const buffer = Buffer.from(await uploadedFile.arrayBuffer());
  const ext = uploadedFile.name.split(".").pop()?.toLowerCase() || "bin";

  const parsed = await parseResumeFile(buffer, uploadedFile.name);

  const resumeSource = await prisma.resumeSource.create({
    data: {
      userId: DEFAULT_USER_ID,
      name,
      sourceType: "original_upload",
      targetRoleType,
      tags: targetRoleType ? [targetRoleType] : [],
      parsedText: parsed.text || null,
      isDefault: setAsDefault,
    },
  });

  if (setAsDefault) await unsetOtherDefaults(targetRoleType, resumeSource.id);

  const versionId = randomUUID();
  const saved = await saveResumeFile({
    folder: "originals",
    userId: DEFAULT_USER_ID,
    versionId,
    versionType: "original",
    ext,
    content: buffer,
  });

  await prisma.resumeSource.update({
    where: { id: resumeSource.id },
    data: { originalFilePath: saved.relativePath },
  });

  await prisma.resumeVersion.create({
    data: {
      id: versionId,
      userId: DEFAULT_USER_ID,
      resumeSourceId: resumeSource.id,
      versionName: `${name} · 原始版`,
      versionType: "original",
      status: "candidate",
      filePath: saved.relativePath,
      fileFormat: ext,
      contentText: parsed.text || null,
      createdBy: "user",
      pendingConfirmations: parsed.warning ? [parsed.warning] : undefined,
    },
  });

  let warning = parsed.warning;
  if (parsed.text) {
    const extraction = await extractAndSaveExperience(resumeSource.id, parsed.text);
    if (!extraction.ok) {
      warning = warning
        ? `${warning}；经历提取也失败：${extraction.message}`
        : `经历提取失败：${extraction.message}`;
    }
  }

  redirect(`/resumes${warning ? `?warning=${encodeURIComponent(warning)}` : "?success=1"}`);
}
