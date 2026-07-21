"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { saveResumeFile, saveAttachmentFile } from "@/lib/storage";
import { parseResumeFile } from "@/lib/document-parser";
import { extractResumeExperience, reformatResumeContent } from "@/lib/llm";
import { saveExtractedExperienceItem } from "@/lib/experience";

type ActionResult = { ok: true } | { ok: false; message: string };

const ALLOWED_AVATAR_TYPES = ["jpg", "jpeg", "png"];

export async function updatePersonalInfo(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const avatarFile = formData.get("avatar");

  if (!name) {
    return { ok: false, message: "姓名不能为空，PDF 简历抬头需要用到它。" };
  }

  let avatarPath: string | undefined;
  if (avatarFile instanceof File && avatarFile.size > 0) {
    const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_AVATAR_TYPES.includes(ext)) {
      return { ok: false, message: "证件照只支持 JPG / PNG 格式。" };
    }
    if (avatarFile.size > 8 * 1024 * 1024) {
      return { ok: false, message: "证件照文件太大了（超过 8MB），换一张小一点的图片试试。" };
    }
    const buffer = Buffer.from(await avatarFile.arrayBuffer());
    const saved = await saveAttachmentFile({
      userId: DEFAULT_USER_ID,
      kind: "avatar",
      ext,
      content: buffer,
    });
    avatarPath = saved.relativePath;
  }

  await prisma.user.update({
    where: { id: DEFAULT_USER_ID },
    data: {
      name,
      email: email || null,
      phone: phone || null,
      ...(avatarPath ? { avatarPath } : {}),
    },
  });

  revalidatePath("/resumes");
  return { ok: true };
}

export async function removeAvatar(): Promise<ActionResult> {
  await prisma.user.update({ where: { id: DEFAULT_USER_ID }, data: { avatarPath: null } });
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

/**
 * 生成一份"格式化版"——用 AI 把这份简历的原始文本重新整理成符合导出规范的排版，
 * 明确要求"只重排版、不总结、不删减"，保证内容详细程度跟原文一致。
 * 直接基于这份简历自己的原始文本，不依赖经历库（经历库的摘要是压缩过的，
 * 也可能因为跨简历去重被移到别的简历名下，两者都会导致内容不完整）。
 * 上传/粘贴简历成功后会自动调用一次，也可以在简历详情页手动点"重新生成"。
 */
export async function generateFormattedVersion(resumeSourceId: string): Promise<ActionResult> {
  const resumeSource = await prisma.resumeSource.findUnique({ where: { id: resumeSourceId } });
  if (!resumeSource) return { ok: false, message: "找不到这份简历来源。" };

  const rawText = (resumeSource.parsedText || "").trim();
  if (!rawText) {
    return { ok: false, message: "这份简历没有可用的原始文本，无法生成格式化版本。" };
  }

  let contentText: string;
  try {
    const { envelope } = await reformatResumeContent(rawText);
    contentText = envelope.result.contentText;
  } catch (error) {
    console.error("[resumes] 生成格式化版本失败：", error);
    return {
      ok: false,
      message: `生成格式化版本失败：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }

  if (!contentText.trim()) {
    return { ok: false, message: "AI 没有返回可用的格式化内容，请稍后重试。" };
  }

  const versionId = randomUUID();
  const saved = await saveResumeFile({
    folder: "formatted",
    userId: DEFAULT_USER_ID,
    versionId,
    versionType: "formatted",
    ext: "txt",
    content: contentText,
  });

  await prisma.resumeVersion.create({
    data: {
      id: versionId,
      userId: DEFAULT_USER_ID,
      resumeSourceId,
      versionName: `${resumeSource.name} · 格式化版`,
      versionType: "formatted",
      status: "candidate",
      filePath: saved.relativePath,
      fileFormat: "txt",
      contentText,
      createdBy: "ai",
    },
  });

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${resumeSourceId}`);
  return { ok: true };
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

  let warning = extraction.ok ? undefined : `简历已保存，但经历提取失败：${extraction.message}`;

  if (extraction.ok) {
    const formatted = await generateFormattedVersion(resumeSource.id);
    if (!formatted.ok) {
      warning = `简历已保存，经历提取成功，但自动生成格式化版本失败：${formatted.message}`;
    }
  }

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
    } else {
      const formatted = await generateFormattedVersion(resumeSource.id);
      if (!formatted.ok) {
        warning = warning ? `${warning}；${formatted.message}` : formatted.message;
      }
    }
  }

  redirect(`/resumes${warning ? `?warning=${encodeURIComponent(warning)}` : "?success=1"}`);
}

export async function updateResumeSourceInfo(
  resumeSourceId: string,
  data: { name: string; targetRoleType: string; isDefault: boolean },
): Promise<ActionResult> {
  if (!data.name.trim()) return { ok: false, message: "简历名称不能为空。" };

  const resumeSource = await prisma.resumeSource.findUnique({ where: { id: resumeSourceId } });
  if (!resumeSource) return { ok: false, message: "找不到这份简历来源。" };

  const targetRoleType = data.targetRoleType.trim() || null;

  if (data.isDefault) await unsetOtherDefaults(targetRoleType, resumeSourceId);

  await prisma.resumeSource.update({
    where: { id: resumeSourceId },
    data: {
      name: data.name.trim(),
      targetRoleType,
      tags: targetRoleType ? [targetRoleType] : [],
      isDefault: data.isDefault,
    },
  });

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${resumeSourceId}`);
  return { ok: true };
}

/**
 * 在简历详情页里编辑某个版本的正文并保存——生成一条新的"格式化版"版本，
 * 不覆盖旧版本，跟系统"全部留痕"的一贯风格保持一致。
 */
export async function saveResumeSourceVersion(resumeSourceId: string, contentText: string): Promise<ActionResult> {
  if (!contentText.trim()) return { ok: false, message: "简历内容不能为空。" };

  const resumeSource = await prisma.resumeSource.findUnique({ where: { id: resumeSourceId } });
  if (!resumeSource) return { ok: false, message: "找不到这份简历来源。" };

  const versionId = randomUUID();
  const saved = await saveResumeFile({
    folder: "formatted",
    userId: DEFAULT_USER_ID,
    versionId,
    versionType: "formatted",
    ext: "txt",
    content: contentText,
  });

  await prisma.resumeVersion.create({
    data: {
      id: versionId,
      userId: DEFAULT_USER_ID,
      resumeSourceId,
      versionName: `${resumeSource.name} · 格式化版（手动编辑）`,
      versionType: "formatted",
      status: "candidate",
      filePath: saved.relativePath,
      fileFormat: "txt",
      contentText,
      createdBy: "user",
    },
  });

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${resumeSourceId}`);
  return { ok: true };
}
