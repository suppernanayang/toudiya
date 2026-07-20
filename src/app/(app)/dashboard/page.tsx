import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { getConfiguredProviders } from "@/lib/llm";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Tag } from "@/components/ui/Tag";
import { getRecentActivity } from "@/lib/dashboard";

export default async function DashboardPage() {
  const [pendingReview, resumeCount, pendingExperience, applicationsInFlight, pendingInterviewPrep, llmSetting] =
    await Promise.all([
      prisma.reviewItem.count({
        where: { decision: "undecided", reviewSession: { userId: DEFAULT_USER_ID } },
      }),
      prisma.resumeSource.count({ where: { userId: DEFAULT_USER_ID } }),
      prisma.experienceItem.count({
        where: { userId: DEFAULT_USER_ID, evidenceStatus: { not: "confirmed" } },
      }),
      prisma.application.count({
        where: {
          userId: DEFAULT_USER_ID,
          currentStatus: { in: ["submitted", "waiting", "interview_invited", "interviewing"] },
        },
      }),
      prisma.application.count({
        where: {
          userId: DEFAULT_USER_ID,
          currentStatus: { in: ["submitted", "waiting", "interview_invited", "interviewing"] },
          interviewPreparations: { none: {} },
        },
      }),
      prisma.llmSetting.findUnique({ where: { userId: DEFAULT_USER_ID } }),
    ]);

  const activity = await getRecentActivity(6);
  const configured = getConfiguredProviders();

  return (
    <PageShell title="工作台" subtitle="待审核、投递进度和面试准备总览">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Metric label="待审核岗位" value={pendingReview} hint="需要你去审核台确认" />
        <Metric label="简历库" value={resumeCount} hint="份简历母版" />
        <Metric label="待补充经历" value={pendingExperience} hint="影响简历定制质量" />
        <Metric label="进行中投递" value={applicationsInFlight} hint={`其中 ${pendingInterviewPrep} 个未生成面试准备`} />
      </div>

      <Panel>
        <PanelHeader title="快捷入口" subtitle="三步完成一次投递" />
        <div className="flex gap-2.5 flex-wrap p-4">
          <Link
            href="/resumes"
            className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-teal bg-teal text-white"
          >
            ① 上传 / 粘贴简历
          </Link>
          <Link
            href="/jobs"
            className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-line bg-surface hover:bg-surface-2"
          >
            ② 导入 JD 或岗位
          </Link>
          <Link
            href="/review"
            className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-line bg-surface hover:bg-surface-2"
          >
            ③ 去审核台确认
          </Link>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="模型设置" subtitle="用户自行选择，本轮先用默认配置" />
        <div className="p-4 grid gap-3 text-sm">
          <Row label="默认供应商" value={llmSetting?.defaultProvider === "openai" ? "OpenAI" : "DeepSeek"} />
          <Row label="默认模型" value={llmSetting?.defaultModel || "-"} />
          <Row label="备用供应商" value={llmSetting?.fallbackProvider === "disabled" ? "不启用" : llmSetting?.fallbackProvider === "openai" ? "OpenAI" : "DeepSeek"} />
          <Row label="调用失败自动切换" value={llmSetting?.autoFallback ? "已开启" : "已关闭"} />
          <div className="flex items-center gap-2 pt-1">
            <span className="text-muted">配置状态：</span>
            <Tag variant={configured.deepseek ? "green" : "rose"}>DeepSeek {configured.deepseek ? "已配置" : "未配置"}</Tag>
            <Tag variant={configured.openai ? "green" : "rose"}>OpenAI {configured.openai ? "已配置" : "未配置"}</Tag>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="最近动态" subtitle="按时间倒序" />
        {activity.length === 0 ? (
          <div className="p-4 text-muted text-sm">还没有动态，先去导入一份简历或一个岗位吧。</div>
        ) : (
          <div className="grid">
            {activity.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[90px_1fr_auto] gap-2.5 items-center px-4 py-3 border-b border-line last:border-b-0 text-sm"
              >
                <time className="text-soft text-xs">{formatRelativeTime(item.time)}</time>
                <span>{item.text}</span>
                <Tag variant="teal">{item.tag}</Tag>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4 shadow-[var(--shadow-panel)]">
      <span className="block text-muted text-sm">{label}</span>
      <strong className="block mt-2 text-2xl">{value}</strong>
      <small className="text-soft">{hint}</small>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay} 天前`;
}
