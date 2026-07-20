import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";

export interface ActivityEntry {
  id: string;
  time: Date;
  text: string;
  tag: string;
}

export async function getRecentActivity(limit = 6): Promise<ActivityEntry[]> {
  const [resumeVersions, jobs, applications] = await Promise.all([
    prisma.resumeVersion.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { job: true },
    }),
    prisma.job.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.application.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { job: true },
    }),
  ]);

  const entries: ActivityEntry[] = [];

  for (const rv of resumeVersions) {
    const label =
      rv.versionType === "ai_draft"
        ? `为「${rv.job ? `${rv.job.company}·${rv.job.title}` : "简历"}」生成 AI 定制简历草稿`
        : rv.versionType === "user_uploaded_final"
          ? `上传了外部修改后的最终版简历「${rv.versionName}」`
          : `创建了简历版本「${rv.versionName}」`;
    entries.push({
      id: `rv-${rv.id}`,
      time: rv.createdAt,
      text: label,
      tag: rv.versionType === "ai_draft" ? "AI 生成" : "简历库",
    });
  }

  for (const job of jobs) {
    entries.push({
      id: `job-${job.id}`,
      time: job.createdAt,
      text: `导入岗位「${job.company}·${job.title}」`,
      tag: "岗位池",
    });
  }

  for (const app of applications) {
    entries.push({
      id: `app-${app.id}`,
      time: app.updatedAt,
      text: `「${app.job.company}·${app.job.title}」投递状态更新为「${STATUS_LABEL[app.currentStatus] || app.currentStatus}」`,
      tag: "投递追踪",
    });
  }

  entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  return entries.slice(0, limit);
}

export const STATUS_LABEL: Record<string, string> = {
  submitted: "已投递",
  waiting: "等待回复",
  interview_invited: "已收到面试邀请",
  interviewing: "面试中",
  offer: "已 Offer",
  rejected: "已拒绝",
  withdrawn: "已撤回",
  closed: "已关闭",
};
