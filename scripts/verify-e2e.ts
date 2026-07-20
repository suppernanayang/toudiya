import "./load-env";
import { prisma } from "../src/lib/db";
import { DEFAULT_USER_ID, ensureDefaultUser } from "../src/lib/current-user";
import { saveResumeFile } from "../src/lib/storage";
import {
  extractResumeExperience,
  analyzeJobDescription,
  customizeResumeForJob,
  generateApplicationMessage,
  generateInterviewPreparation,
} from "../src/lib/llm";
import { ensureReviewItemForJob, buildExperienceSummaryText } from "../src/lib/review";
import { randomUUID } from "crypto";

const SAMPLE_RESUME = `姓名：张小鸭
教育经历：某大学 市场营销专业 本科 2022.09 - 2026.06

实习经历：
内容社区运营实习生 · 某内容平台（2025.03 - 2025.09）
- 参与拆解社区热门内容供给结构，整理了 120 多条竞品内容样本，输出选题标签体系。
- 协助搭建内容复盘表，按曝光、互动、收藏等维度记录内容表现。
- 目前还没有具体的互动率或转化率提升数据。

校园经历：
校园新媒体运营负责人 · 校学生会新媒体中心（2023.09 - 2024.06）
- 负责账号选题规划和发布节奏维护，结合评论反馈调整内容表达。
- 活动报名转化率从 12% 提升到 18%（有后台数据支持）。

技能：新媒体运营、数据分析基础、Excel、PPT`;

const SAMPLE_JD = `【小红书】产品运营实习生（内容生态方向）

岗位职责：
1. 负责内容生态相关数据分析，洞察用户内容消费行为。
2. 协助搭建内容供给和消费的匹配策略，推动内容运营效率提升。
3. 跟踪内容表现数据，输出复盘报告，推动策略迭代。

任职要求：
1. 本科及以上学历，市场营销/传媒/统计相关专业优先。
2. 具备较强的数据分析能力和用户洞察能力。
3. 有内容运营或社区运营相关实习经验优先。
4. 每周至少能实习 4 天，实习时间 3 个月以上。`;

async function main() {
  console.log("==== 投递鸭端到端验证开始 ====\n");

  await ensureDefaultUser();

  // 清理上一次跑验证脚本留下的测试数据，保证脚本可重复运行
  const oldJobs = await prisma.job.findMany({ where: { userId: DEFAULT_USER_ID, company: "验证脚本-小红书" } });
  for (const job of oldJobs) {
    await prisma.interviewPreparation.deleteMany({ where: { jobId: job.id } });
    await prisma.application.deleteMany({ where: { jobId: job.id } });
    await prisma.applicationPackage.deleteMany({ where: { jobId: job.id } });
    await prisma.reviewItem.deleteMany({ where: { jobId: job.id } });
    await prisma.resumeJobMatch.deleteMany({ where: { jobId: job.id } });
    await prisma.resumeVersion.updateMany({ where: { jobId: job.id }, data: { jobId: null } });
    await prisma.jobAnalysis.deleteMany({ where: { jobId: job.id } });
  }
  await prisma.job.deleteMany({ where: { userId: DEFAULT_USER_ID, company: "验证脚本-小红书" } });
  const oldSources = await prisma.resumeSource.findMany({ where: { userId: DEFAULT_USER_ID, name: "验证脚本-测试简历" } });
  for (const source of oldSources) {
    await prisma.experienceDetail.deleteMany({ where: { experienceItem: { resumeSourceId: source.id } } });
    await prisma.experienceItem.deleteMany({ where: { resumeSourceId: source.id } });
    await prisma.resumeVersion.deleteMany({ where: { resumeSourceId: source.id } });
  }
  await prisma.resumeSource.deleteMany({ where: { userId: DEFAULT_USER_ID, name: "验证脚本-测试简历" } });
  console.log("✅ 已清理旧的验证测试数据\n");

  // ---- 步骤 1：创建简历 + AI 提取经历 ----
  console.log("【步骤 1】创建简历，调用 AI 提取经历库...");
  const resumeSource = await prisma.resumeSource.create({
    data: {
      userId: DEFAULT_USER_ID,
      name: "验证脚本-测试简历",
      sourceType: "original_upload",
      targetRoleType: "产品运营",
      tags: ["产品运营"],
      parsedText: SAMPLE_RESUME,
      isDefault: true,
    },
  });

  const originalVersionId = randomUUID();
  const savedOriginal = await saveResumeFile({
    folder: "originals",
    userId: DEFAULT_USER_ID,
    versionId: originalVersionId,
    versionType: "original",
    ext: "txt",
    content: SAMPLE_RESUME,
  });
  await prisma.resumeVersion.create({
    data: {
      id: originalVersionId,
      userId: DEFAULT_USER_ID,
      resumeSourceId: resumeSource.id,
      versionName: "验证脚本-测试简历 · 原始版",
      versionType: "original",
      status: "candidate",
      filePath: savedOriginal.relativePath,
      fileFormat: "txt",
      contentText: SAMPLE_RESUME,
      createdBy: "user",
    },
  });

  const extraction = await extractResumeExperience(SAMPLE_RESUME);
  console.log(`  DeepSeek/OpenAI 提取到 ${extraction.envelope.result.length} 条经历，使用模型：${extraction.meta.provider}/${extraction.meta.model}`);
  for (const item of extraction.envelope.result) {
    await prisma.experienceItem.create({
      data: {
        userId: DEFAULT_USER_ID,
        resumeSourceId: resumeSource.id,
        experienceType: item.experienceType,
        title: item.title,
        organization: item.organization || null,
        role: item.role || null,
        startDate: item.startDate || null,
        endDate: item.endDate || null,
        summary: item.summary,
        tags: item.tags,
        skills: item.skills,
        evidenceStatus: item.evidenceStatus,
      },
    });
    console.log(`    - [${item.evidenceStatus}] ${item.title}`);
  }
  console.log("  ✅ 步骤 1 完成\n");

  // ---- 步骤 2：创建岗位 + JD 分析 ----
  console.log("【步骤 2】创建岗位，调用 AI 分析 JD...");
  const job = await prisma.job.create({
    data: {
      userId: DEFAULT_USER_ID,
      company: "验证脚本-小红书",
      title: "产品运营实习生",
      sourceType: "manual_jd",
      city: "上海",
      jdRawText: SAMPLE_JD,
      status: "imported",
    },
  });

  const analysis = await analyzeJobDescription({ company: job.company, title: job.title, jdText: SAMPLE_JD });
  console.log(`  JD 分析使用模型：${analysis.meta.provider}/${analysis.meta.model}`);
  console.log(`  岗位摘要：${analysis.envelope.result.summary}`);
  console.log(`  关键词：${analysis.envelope.result.keywords.join("、")}`);

  await prisma.jobAnalysis.create({
    data: {
      jobId: job.id,
      roleType: analysis.envelope.result.roleType,
      summary: analysis.envelope.result.summary,
      responsibilities: analysis.envelope.result.responsibilities,
      hardRequirements: analysis.envelope.result.hardRequirements,
      niceToHave: analysis.envelope.result.niceToHave,
      keywords: analysis.envelope.result.keywords,
      experienceYears: analysis.envelope.result.experienceYears,
      educationRequirements: analysis.envelope.result.educationRequirements,
      riskFlags: analysis.envelope.result.riskFlags,
      interviewFocus: analysis.envelope.result.interviewFocus,
      modelProvider: analysis.meta.provider,
      modelName: analysis.meta.model,
    },
  });
  await prisma.job.update({ where: { id: job.id }, data: { status: "analyzed" } });
  console.log("  ✅ 步骤 2 完成\n");

  // ---- 步骤 3：生成 AI 定制简历草稿 ----
  console.log("【步骤 3】生成 AI 定制简历草稿...");
  const reviewItem = await ensureReviewItemForJob(job.id);
  const experienceSummary = await buildExperienceSummaryText();

  const customization = await customizeResumeForJob({
    resumeText: SAMPLE_RESUME,
    experienceSummary,
    jdText: SAMPLE_JD,
    jobKeywords: analysis.envelope.result.keywords,
  });
  console.log(`  简历定制使用模型：${customization.meta.provider}/${customization.meta.model}`);
  console.log(`  修改点数量：${customization.envelope.result.changeSummary.length}`);
  console.log(`  待确认项：${customization.envelope.pending_confirmations.length} 条`);
  customization.envelope.pending_confirmations.forEach((q) => console.log(`    - ${q}`));

  const aiDraftVersionId = randomUUID();
  const savedDraft = await saveResumeFile({
    folder: "ai-drafts",
    userId: DEFAULT_USER_ID,
    jobId: job.id,
    versionId: aiDraftVersionId,
    versionType: "ai_draft",
    ext: "txt",
    content: customization.envelope.result.contentText,
  });
  await prisma.resumeVersion.create({
    data: {
      id: aiDraftVersionId,
      userId: DEFAULT_USER_ID,
      resumeSourceId: resumeSource.id,
      parentVersionId: originalVersionId,
      jobId: job.id,
      versionName: `${job.company}·${job.title} AI 定制版`,
      versionType: "ai_draft",
      status: "candidate",
      filePath: savedDraft.relativePath,
      fileFormat: "txt",
      contentText: customization.envelope.result.contentText,
      changeSummary: JSON.parse(JSON.stringify(customization.envelope.result.changeSummary)),
      riskNotes: customization.envelope.risk_notes,
      pendingConfirmations: customization.envelope.pending_confirmations,
      createdBy: "ai",
    },
  });
  await prisma.reviewItem.update({
    where: { id: reviewItem.id },
    data: { aiDraftResumeVersionId: aiDraftVersionId, currentSelectedResumeVersionId: aiDraftVersionId },
  });
  await prisma.job.update({ where: { id: job.id }, data: { status: "in_review" } });
  console.log("  ✅ 步骤 3 完成\n");

  // ---- 步骤 4：生成投递话术 ----
  console.log("【步骤 4】生成投递话术...");
  const messageResult = await generateApplicationMessage({
    company: job.company,
    title: job.title,
    jobSummary: analysis.envelope.result.summary,
    resumeSummary: customization.envelope.result.contentText.slice(0, 800),
  });
  console.log(`  话术使用模型：${messageResult.meta.provider}/${messageResult.meta.model}`);
  console.log(`  投递话术：${messageResult.envelope.result.message}`);
  await prisma.reviewItem.update({
    where: { id: reviewItem.id },
    data: { applicationMessage: messageResult.envelope.result.message, emailBody: messageResult.envelope.result.emailBody },
  });
  console.log("  ✅ 步骤 4 完成\n");

  // ---- 步骤 5：设为最终投递版 + 标记投递 ----
  console.log("【步骤 5】设为最终投递版，标记投递...");
  await prisma.reviewItem.update({
    where: { id: reviewItem.id },
    data: { finalResumeVersionId: aiDraftVersionId, decision: "apply", riskAcknowledged: true },
  });

  const applicationPackage = await prisma.applicationPackage.create({
    data: {
      userId: DEFAULT_USER_ID,
      jobId: job.id,
      reviewItemId: reviewItem.id,
      finalResumeVersionId: aiDraftVersionId,
      applicationMessage: messageResult.envelope.result.message,
      emailBody: messageResult.envelope.result.emailBody,
      submissionMethod: "manual",
      status: "confirmed",
    },
  });

  const application = await prisma.application.create({
    data: {
      userId: DEFAULT_USER_ID,
      jobId: job.id,
      applicationPackageId: applicationPackage.id,
      submittedAt: new Date(),
      currentStatus: "submitted",
    },
  });
  await prisma.job.update({ where: { id: job.id }, data: { status: "applied" } });
  console.log("  ✅ 步骤 5 完成\n");

  // ---- 步骤 6：生成面试准备材料 ----
  console.log("【步骤 6】生成面试准备材料...");
  const interviewResult = await generateInterviewPreparation({
    jdText: SAMPLE_JD,
    finalResumeText: customization.envelope.result.contentText,
    experienceSummary,
    applicationMessage: messageResult.envelope.result.message,
  });
  console.log(`  面试准备使用模型：${interviewResult.meta.provider}/${interviewResult.meta.model}`);
  console.log(`  自我介绍：${interviewResult.envelope.result.selfIntro}`);
  console.log(`  可能追问数量：${interviewResult.envelope.result.likelyQuestions.length}`);

  await prisma.interviewPreparation.create({
    data: {
      userId: DEFAULT_USER_ID,
      jobId: job.id,
      applicationId: application.id,
      resumeVersionId: aiDraftVersionId,
      selfIntro: interviewResult.envelope.result.selfIntro,
      keyExperienceBrief: interviewResult.envelope.result.keyExperienceBrief,
      likelyQuestions: interviewResult.envelope.result.likelyQuestions,
      starAnswers: JSON.parse(JSON.stringify(interviewResult.envelope.result.starAnswers)),
      businessQuestions: interviewResult.envelope.result.businessQuestions,
      skillsToReview: interviewResult.envelope.result.skillsToReview,
      questionsToAsk: interviewResult.envelope.result.questionsToAsk,
      riskNotes: interviewResult.envelope.risk_notes,
      modelProvider: interviewResult.meta.provider,
      modelName: interviewResult.meta.model,
    },
  });
  console.log("  ✅ 步骤 6 完成\n");

  console.log("==== 全部 6 步端到端验证通过 ====");
  console.log(`\n可以在浏览器里打开 http://localhost:3000/review?job=${job.id} 查看真实页面效果。`);
}

main()
  .catch((error) => {
    console.error("\n❌ 验证失败：", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
