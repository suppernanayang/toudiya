"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { generateInterviewPreparation } from "@/lib/llm";
import { buildExperienceSummaryText } from "@/lib/review";

type ActionResult = { ok: true } | { ok: false; message: string };

export async function generateInterviewPrep(jobId: string): Promise<ActionResult> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, message: "岗位不存在" };

  const application = await prisma.application.findFirst({
    where: { jobId, userId: DEFAULT_USER_ID },
    orderBy: { updatedAt: "desc" },
    include: { applicationPackage: { include: { finalResumeVersion: true } } },
  });

  const reviewItem = await prisma.reviewItem.findFirst({
    where: { jobId, reviewSession: { userId: DEFAULT_USER_ID } },
    orderBy: { updatedAt: "desc" },
  });

  const finalResumeVersion =
    application?.applicationPackage?.finalResumeVersion ||
    (reviewItem?.finalResumeVersionId
      ? await prisma.resumeVersion.findUnique({ where: { id: reviewItem.finalResumeVersionId } })
      : null) ||
    (reviewItem?.currentSelectedResumeVersionId
      ? await prisma.resumeVersion.findUnique({ where: { id: reviewItem.currentSelectedResumeVersionId } })
      : null);

  if (!finalResumeVersion || !finalResumeVersion.contentText) {
    return { ok: false, message: "还没有可用的最终投递简历，请先在审核台设为最终投递版。" };
  }

  try {
    const experienceSummary = await buildExperienceSummaryText();
    const { envelope, meta } = await generateInterviewPreparation({
      jdText: job.jdRawText || "",
      finalResumeText: finalResumeVersion.contentText,
      experienceSummary,
      applicationMessage: application?.applicationPackage?.applicationMessage || reviewItem?.applicationMessage || "",
    });

    await prisma.interviewPreparation.create({
      data: {
        userId: DEFAULT_USER_ID,
        jobId,
        applicationId: application?.id,
        resumeVersionId: finalResumeVersion.id,
        selfIntro: envelope.result.selfIntro,
        keyExperienceBrief: envelope.result.keyExperienceBrief,
        likelyQuestions: envelope.result.likelyQuestions,
        starAnswers: JSON.parse(JSON.stringify(envelope.result.starAnswers)),
        businessQuestions: envelope.result.businessQuestions,
        skillsToReview: envelope.result.skillsToReview,
        questionsToAsk: envelope.result.questionsToAsk,
        riskNotes: envelope.risk_notes,
        modelProvider: meta.provider,
        modelName: meta.model,
      },
    });

    revalidatePath("/interviews");
    return { ok: true };
  } catch (error) {
    console.error("[interviews] 生成面试准备失败：", error);
    return { ok: false, message: error instanceof Error ? error.message : "生成失败，未知错误" };
  }
}
