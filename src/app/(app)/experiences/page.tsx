import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Tag, TagVariant } from "@/components/ui/Tag";

const TYPE_LABEL: Record<string, string> = {
  education: "教育经历",
  internship: "实习经历",
  project: "项目经历",
  campus: "校园经历",
  work: "工作经历",
  certificate: "证书",
  award: "奖项",
  portfolio: "作品",
};

const EVIDENCE_LABEL: Record<string, { label: string; variant: TagVariant }> = {
  confirmed: { label: "已确认", variant: "green" },
  needs_confirmation: { label: "待确认", variant: "amber" },
  incomplete: { label: "信息不完整", variant: "amber" },
};

export default async function ExperiencesPage() {
  const items = await prisma.experienceItem.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
    include: { resumeSource: true },
  });

  return (
    <PageShell title="经历库" subtitle="把简历背后的细节整理成可复用资产，AI 只能基于这里的内容改写简历">
      <Panel>
        <PanelHeader
          title="经历条目"
          subtitle="上传或粘贴简历后自动提取，本轮暂不支持在页面里手动编辑，可在简历库里重新提交来源简历"
          action={<span className="text-muted text-sm">共 {items.length} 条</span>}
        />
        {items.length === 0 ? (
          <div className="p-4 text-muted text-sm">
            还没有经历条目，先去<span className="text-teal-dark">简历库</span>上传或粘贴一份简历，系统会自动提取。
          </div>
        ) : (
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-3.5 p-4">
            {items.map((item) => {
              const evidence = EVIDENCE_LABEL[item.evidenceStatus] || { label: item.evidenceStatus, variant: "default" as TagVariant };
              return (
                <div key={item.id} className="border border-line rounded-lg bg-white p-3.5 grid gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-sm">{item.title}</strong>
                    <Tag variant={evidence.variant}>{evidence.label}</Tag>
                  </div>
                  <span className="text-muted text-xs">
                    {TYPE_LABEL[item.experienceType] || item.experienceType}
                    {item.organization ? ` · ${item.organization}` : ""}
                    {item.startDate || item.endDate ? ` · ${item.startDate || "?"} - ${item.endDate || "?"}` : ""}
                  </span>
                  {item.summary ? <p className="m-0 text-muted text-sm leading-relaxed">{item.summary}</p> : null}
                  {Array.isArray(item.tags) && item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(item.tags as string[]).map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  ) : null}
                  <span className="text-soft text-xs">来源简历：{item.resumeSource?.name || "-"}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
