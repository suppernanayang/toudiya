"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { saveResumeFile } from "@/lib/storage";
import { parseResumeFile } from "@/lib/document-parser";
import { customizeResumeForJob, generateApplicationMessage } from "@/lib/llm";
import { buildExperienceSummaryText, ensureReviewItemForJob, sortVersionsByQuality } from "@/lib/review";

type ActionResult = { ok: true } | { ok: false; message: string };

function fail(message: string): ActionResult {
  return { ok: false, message };
}

async function refreshReview(jobId: string) {
  revalidatePath("/review");
  revalidatePath(`/review?job=${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

export async function generateAiDraft(jobId: string): Promise<ActionResult> {
  const reviewItem = await ensureReviewItemForJob(jobId);
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { jobAnalysis: true } });
  if (!job) return fail("岗位不存在");
  if (!job.jobAnalysis) return fail("请先完成 JD 分析，再生成定制简历。");

  const baseVersion = reviewItem.recommendedResumeVersionId
    ? await prisma.resumeVersion.findUnique({ where: { id: reviewItem.recommendedResumeVersionId } })
    : null;

  if (!baseVersion || !baseVersion.contentText) {
    return fail("找不到可用的基准简历，请先在简历库上传或粘贴一份简历。");
  }

  try {
    const experienceSummary = await buildExperienceSummaryText();
    const { envelope, meta } = await customizeResumeForJob({
      resumeText: baseVersion.contentText,
      experienceSummary,
      jdText: job.jdRawText || "",
      jobKeywords: (job.jobAnalysis.keywords as string[]) || [],
    });

    const versionId = randomUUID();
    const saved = await saveResumeFile({
      folder: "ai-drafts",
      userId: DEFAULT_USER_ID,
      jobId: job.id,
      versionId,
      versionType: "ai_draft",
      ext: "txt",
      content: envelope.result.contentText,
    });

    await prisma.resumeVersion.create({
      data: {
        id: versionId,
        userId: DEFAULT_USER_ID,
        resumeSourceId: baseVersion.resumeSourceId,
        parentVersionId: baseVersion.id,
        jobId: job.id,
        versionName: `${job.company}·${job.title} AI 定制版`,
        versionType: "ai_draft",
        status: "candidate",
        filePath: saved.relativePath,
        fileFormat: "txt",
        contentText: envelope.result.contentText,
        changeSummary: JSON.parse(JSON.stringify(envelope.result.changeSummary)),
        riskNotes: envelope.risk_notes,
        pendingConfirmations: envelope.pending_confirmations,
        createdBy: "ai",
      },
    });

    await prisma.reviewItem.update({
      where: { id: reviewItem.id },
      data: {
        aiDraftResumeVersionId: versionId,
        currentSelectedResumeVersionId: versionId,
      },
    });

    await prisma.job.update({ where: { id: job.id }, data: { status: "in_review" } });

    console.log(`[llm] resume_customization 使用 ${meta.provider}/${meta.model}${meta.usedFallback ? "（备用模型）" : ""}`);
    await refreshReview(jobId);
    return { ok: true };
  } catch (error) {
    console.error("[review] 生成定制简历失败：", error);
    return fail(error instanceof Error ? error.message : "生成定制简历失败，未知错误");
  }
}

export async function saveEditedVersion(
  reviewItemId: string,
  jobId: string,
  contentText: string,
): Promise<ActionResult> {
  if (!contentText.trim()) return fail("简历内容不能为空。");

  const reviewItem = await prisma.reviewItem.findUnique({ where: { id: reviewItemId } });
  if (!reviewItem) return fail("找不到对应的审核记录。");

  const parentVersionId = reviewItem.currentSelectedResumeVersionId;
  const parentVersion = parentVersionId
    ? await prisma.resumeVersion.findUnique({ where: { id: parentVersionId } })
    : null;

  const resumeSourceId = parentVersion?.resumeSourceId;
  if (!resumeSourceId) return fail("找不到这份简历所属的简历来源，无法保存编辑版本。");

  const job = await prisma.job.findUnique({ where: { id: jobId } });

  const versionId = randomUUID();
  const saved = await saveResumeFile({
    folder: "edited",
    userId: DEFAULT_USER_ID,
    jobId,
    versionId,
    versionType: "platform_edited",
    ext: "txt",
    content: contentText,
  });

  await prisma.resumeVersion.create({
    data: {
      id: versionId,
      userId: DEFAULT_USER_ID,
      resumeSourceId,
      parentVersionId,
      jobId,
      versionName: `${job ? `${job.company}·${job.title} ` : ""}平台内编辑版`,
      versionType: "platform_edited",
      status: "candidate",
      filePath: saved.relativePath,
      fileFormat: "txt",
      contentText,
      createdBy: "user",
    },
  });

  await prisma.reviewItem.update({
    where: { id: reviewItemId },
    data: { currentSelectedResumeVersionId: versionId },
  });

  await refreshReview(jobId);
  return { ok: true };
}

export async function uploadFinalVersion(
  reviewItemId: string,
  jobId: string,
  file: File,
): Promise<ActionResult> {
  if (!file || file.size === 0) return fail("请先选择要上传的文件。");

  const reviewItem = await prisma.reviewItem.findUnique({ where: { id: reviewItemId } });
  if (!reviewItem) return fail("找不到对应的审核记录。");

  const parentVersionId = reviewItem.currentSelectedResumeVersionId;
  const parentVersion = parentVersionId
    ? await prisma.resumeVersion.findUnique({ where: { id: parentVersionId } })
    : null;
  const resumeSourceId = parentVersion?.resumeSourceId;
  if (!resumeSourceId) return fail("找不到这份简历所属的简历来源，无法上传最终版。");

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const parsed = await parseResumeFile(buffer, file.name);

  const versionId = randomUUID();
  const saved = await saveResumeFile({
    folder: "uploaded-finals",
    userId: DEFAULT_USER_ID,
    jobId,
    versionId,
    versionType: "user_uploaded_final",
    ext,
    content: buffer,
  });

  await prisma.resumeVersion.create({
    data: {
      id: versionId,
      userId: DEFAULT_USER_ID,
      resumeSourceId,
      parentVersionId,
      jobId,
      versionName: `${job ? `${job.company}·${job.title} ` : ""}外部回传最终版`,
      versionType: "user_uploaded_final",
      status: "selected",
      filePath: saved.relativePath,
      fileFormat: ext,
      contentText: parsed.text || null,
      createdBy: "user",
      pendingConfirmations: parsed.warning ? [parsed.warning] : undefined,
    },
  });

  // 按 REVIEW_DESK_SPEC 规则：用户上传最终版默认优先级最高，直接设为当前选中 + 最终投递版。
  await prisma.reviewItem.update({
    where: { id: reviewItemId },
    data: { currentSelectedResumeVersionId: versionId, finalResumeVersionId: versionId },
  });

  await refreshReview(jobId);
  return parsed.warning ? fail(`文件已保存，但：${parsed.warning}`) : { ok: true };
}

export async function setFinalVersion(reviewItemId: string, versionId: string, jobId: string): Promise<ActionResult> {
  await prisma.reviewItem.update({
    where: { id: reviewItemId },
    data: { finalResumeVersionId: versionId, currentSelectedResumeVersionId: versionId },
  });
  await refreshReview(jobId);
  return { ok: true };
}

/**
 * 点击左侧某张版本卡片时调用：只是切换"当前正在查看/编辑的版本"，
 * 不会影响"最终投递版"（那个必须用户显式点「设为最终投递版」才会改）。
 */
export async function selectResumeVersion(
  reviewItemId: string,
  versionId: string,
  jobId: string,
): Promise<ActionResult> {
  await prisma.reviewItem.update({
    where: { id: reviewItemId },
    data: { currentSelectedResumeVersionId: versionId },
  });
  await refreshReview(jobId);
  return { ok: true };
}

/**
 * 手动更换这个岗位的"基准简历"，从简历库任选一份简历来源，
 * 优先用它质量最好的版本（格式化版 > 方向简历 > 原始版——原始版是纯文本提取
 * 结果，没有分区标题格式，直接拿去定制/预览/导出会报错），
 * 作为新的基准版并立刻切换为当前查看版本。
 * 之前生成过的 AI 草稿、编辑版、上传版都不会被删除，只是不再是默认显示的那份。
 */
export async function setBaseResumeVersion(
  reviewItemId: string,
  resumeSourceId: string,
  jobId: string,
): Promise<ActionResult> {
  const candidates = await prisma.resumeVersion.findMany({
    where: { resumeSourceId, versionType: { in: ["formatted", "direction", "original"] } },
    orderBy: { createdAt: "desc" },
  });
  const latestVersion = sortVersionsByQuality(candidates)[0];

  if (!latestVersion) {
    return fail("这份简历来源还没有可用的版本。");
  }

  await prisma.reviewItem.update({
    where: { id: reviewItemId },
    data: {
      recommendedResumeVersionId: latestVersion.id,
      currentSelectedResumeVersionId: latestVersion.id,
    },
  });

  await refreshReview(jobId);
  return { ok: true };
}

export async function updateApplicationMessage(
  reviewItemId: string,
  message: string,
  jobId: string,
): Promise<ActionResult> {
  await prisma.reviewItem.update({ where: { id: reviewItemId }, data: { applicationMessage: message } });
  await refreshReview(jobId);
  return { ok: true };
}

export async function generateMessageDraft(jobId: string): Promise<ActionResult> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { jobAnalysis: true } });
  if (!job) return fail("岗位不存在");

  const reviewItem = await ensureReviewItemForJob(jobId);
  const resumeVersionId = reviewItem.currentSelectedResumeVersionId || reviewItem.recommendedResumeVersionId;
  const resumeVersion = resumeVersionId
    ? await prisma.resumeVersion.findUnique({ where: { id: resumeVersionId } })
    : null;

  try {
    const { envelope } = await generateApplicationMessage({
      company: job.company,
      title: job.title,
      jobSummary: job.jobAnalysis?.summary || job.jdRawText || "",
      resumeSummary: resumeVersion?.contentText?.slice(0, 1500) || "(暂无简历内容)",
    });

    await prisma.reviewItem.update({
      where: { id: reviewItem.id },
      data: { applicationMessage: envelope.result.message, emailBody: envelope.result.emailBody },
    });

    await refreshReview(jobId);
    return { ok: true };
  } catch (error) {
    console.error("[review] 生成投递话术失败：", error);
    return fail(error instanceof Error ? error.message : "生成投递话术失败，未知错误");
  }
}

export async function decideReviewItem(
  reviewItemId: string,
  jobId: string,
  decision: "apply" | "pause" | "skip",
): Promise<ActionResult> {
  const reviewItem = await prisma.reviewItem.findUnique({ where: { id: reviewItemId } });
  if (!reviewItem) return fail("找不到对应的审核记录。");

  if (decision === "apply") {
    if (!reviewItem.finalResumeVersionId) {
      return fail("请先点击「设为最终投递版」确认要使用的简历，再执行投递。");
    }

    const applicationPackage = await prisma.applicationPackage.upsert({
      where: { reviewItemId },
      update: {
        finalResumeVersionId: reviewItem.finalResumeVersionId,
        applicationMessage: reviewItem.applicationMessage,
        emailBody: reviewItem.emailBody,
        status: "confirmed",
      },
      create: {
        userId: DEFAULT_USER_ID,
        jobId,
        reviewItemId,
        finalResumeVersionId: reviewItem.finalResumeVersionId,
        applicationMessage: reviewItem.applicationMessage,
        emailBody: reviewItem.emailBody,
        submissionMethod: "manual",
        status: "confirmed",
      },
    });

    await prisma.application.upsert({
      where: { applicationPackageId: applicationPackage.id },
      update: { currentStatus: "submitted", submittedAt: new Date() },
      create: {
        userId: DEFAULT_USER_ID,
        jobId,
        applicationPackageId: applicationPackage.id,
        submittedAt: new Date(),
        currentStatus: "submitted",
      },
    });

    await prisma.job.update({ where: { id: jobId }, data: { status: "applied" } });
  } else if (decision === "pause") {
    await prisma.job.update({ where: { id: jobId }, data: { status: "paused" } });
  } else {
    await prisma.job.update({ where: { id: jobId }, data: { status: "rejected_by_user" } });
  }

  await prisma.reviewItem.update({
    where: { id: reviewItemId },
    data: { decision, riskAcknowledged: decision === "apply" },
  });

  await refreshReview(jobId);
  revalidatePath("/applications");
  return { ok: true };
}
