"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { analyzeJobDescription } from "@/lib/llm";

export async function runJobAnalysis(jobId: string): Promise<{ ok: boolean; message?: string }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, message: "岗位不存在" };
  if (!job.jdRawText || !job.jdRawText.trim()) {
    return { ok: false, message: "这个岗位还没有 JD 正文，无法分析，请先补充。" };
  }

  try {
    const { envelope, meta } = await analyzeJobDescription({
      company: job.company,
      title: job.title,
      jdText: job.jdRawText,
    });

    await prisma.jobAnalysis.upsert({
      where: { jobId: job.id },
      update: {
        roleType: envelope.result.roleType,
        summary: envelope.result.summary,
        responsibilities: envelope.result.responsibilities,
        hardRequirements: envelope.result.hardRequirements,
        niceToHave: envelope.result.niceToHave,
        keywords: envelope.result.keywords,
        experienceYears: envelope.result.experienceYears,
        educationRequirements: envelope.result.educationRequirements,
        riskFlags: [...envelope.result.riskFlags, ...envelope.risk_notes],
        interviewFocus: envelope.result.interviewFocus,
        modelProvider: meta.provider,
        modelName: meta.model,
      },
      create: {
        jobId: job.id,
        roleType: envelope.result.roleType,
        summary: envelope.result.summary,
        responsibilities: envelope.result.responsibilities,
        hardRequirements: envelope.result.hardRequirements,
        niceToHave: envelope.result.niceToHave,
        keywords: envelope.result.keywords,
        experienceYears: envelope.result.experienceYears,
        educationRequirements: envelope.result.educationRequirements,
        riskFlags: [...envelope.result.riskFlags, ...envelope.risk_notes],
        interviewFocus: envelope.result.interviewFocus,
        modelProvider: meta.provider,
        modelName: meta.model,
      },
    });

    await prisma.job.update({ where: { id: job.id }, data: { status: "analyzed" } });
    revalidatePath("/jobs");
    revalidatePath("/review");
    return { ok: true };
  } catch (error) {
    console.error("[jobs] JD 分析失败：", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "JD 分析失败，未知错误",
    };
  }
}

export async function createJobFromText(formData: FormData) {
  const company = String(formData.get("company") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim() || null;
  const jdText = String(formData.get("jdText") || "").trim();

  if (!company || !title) {
    redirect(`/jobs?warning=${encodeURIComponent("公司和岗位名称不能为空。")}`);
  }

  const job = await prisma.job.create({
    data: {
      userId: DEFAULT_USER_ID,
      company,
      title,
      sourceType: "manual_jd",
      url,
      jdRawText: jdText || null,
      status: "imported",
    },
  });

  if (!jdText) {
    redirect(`/jobs?warning=${encodeURIComponent("岗位已保存，但还没有 JD 正文，稍后可以补充再分析。")}`);
  }

  const analysis = await runJobAnalysis(job.id);
  redirect(
    analysis.ok
      ? "/jobs?success=1"
      : `/jobs?warning=${encodeURIComponent(`岗位已保存，但 JD 分析失败：${analysis.message}`)}`,
  );
}

export async function analyzeJobFormAction(formData: FormData) {
  const jobId = String(formData.get("jobId") || "");
  const result = await runJobAnalysis(jobId);
  redirect(
    result.ok
      ? "/jobs?success=1"
      : `/jobs?warning=${encodeURIComponent(result.message || "分析失败")}`,
  );
}
