import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Tag, TagVariant } from "@/components/ui/Tag";
import { STATUS_LABEL } from "@/lib/dashboard";
import { StatusSelect } from "./StatusSelect";

const STATUS_VARIANT: Record<string, TagVariant> = {
  submitted: "default",
  waiting: "default",
  interview_invited: "blue",
  interviewing: "blue",
  offer: "green",
  rejected: "rose",
  withdrawn: "default",
  closed: "default",
};

export default async function ApplicationsPage() {
  const applications = await prisma.application.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { updatedAt: "desc" },
    include: {
      job: true,
      applicationPackage: { include: { finalResumeVersion: true } },
    },
  });

  return (
    <PageShell title="投递追踪" subtitle="记录每次投递使用的最终材料、当前状态和下一步动作">
      <Panel>
        <PanelHeader title="投递明细" subtitle="按最近更新排序" action={<span className="text-muted text-sm">共 {applications.length} 条</span>} />
        {applications.length === 0 ? (
          <div className="p-4 text-muted text-sm">
            还没有投递记录，去<span className="text-teal-dark">审核台</span>确认一个岗位的最终投递版后点击「投递」即可。
          </div>
        ) : (
          <div className="grid">
            {applications.map((app) => (
              <div key={app.id} className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_0.8fr_auto] gap-2.5 items-center px-4 py-3.5 border-b border-line last:border-b-0">
                <div>
                  <strong className="text-sm">{app.job.company} · {app.job.title}</strong>
                  <div className="text-muted text-xs mt-1">
                    {app.applicationPackage?.finalResumeVersion.versionName || "最终简历未知"}
                  </div>
                </div>
                <span className="text-muted text-sm">
                  {app.submittedAt ? new Date(app.submittedAt).toLocaleString("zh-CN") : "-"}
                </span>
                <Tag variant={STATUS_VARIANT[app.currentStatus] || "default"}>
                  {STATUS_LABEL[app.currentStatus] || app.currentStatus}
                </Tag>
                <div className="flex items-center gap-3 justify-end">
                  <StatusSelect applicationId={app.id} value={app.currentStatus} />
                  <Link href={`/interviews?job=${app.jobId}`} className="text-teal-dark text-sm whitespace-nowrap">
                    面试准备
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
