import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { ExperienceCard, type ExperienceItemData } from "./ExperienceCard";
import { DuplicatePairCard } from "./DuplicatePairCard";

export default async function ExperiencesPage() {
  const rawItems = await prisma.experienceItem.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
    include: { resumeSource: true, duplicateOf: true },
  });

  const toData = (item: {
    id: string;
    experienceType: string;
    title: string;
    organization: string | null;
    role: string | null;
    startDate: string | null;
    endDate: string | null;
    summary: string | null;
    tags: unknown;
    evidenceStatus: string;
    resumeSource?: { name: string } | null;
  }): ExperienceItemData => ({
    id: item.id,
    experienceType: item.experienceType,
    title: item.title,
    organization: item.organization,
    role: item.role,
    startDate: item.startDate,
    endDate: item.endDate,
    summary: item.summary,
    tags: (item.tags as string[] | null) || [],
    evidenceStatus: item.evidenceStatus,
    resumeSourceName: item.resumeSource?.name || null,
  });

  // 待确认更新的组合：newItem 指向 oldItem（duplicateOfId 非空且原始记录还在）
  const pendingPairs = rawItems
    .filter((item) => item.duplicateOfId && item.duplicateOf)
    .map((item) => ({ newItem: toData(item), oldItem: toData(item.duplicateOf!) }));

  const idsInPendingPairs = new Set<string>();
  pendingPairs.forEach((p) => {
    idsInPendingPairs.add(p.newItem.id);
    idsInPendingPairs.add(p.oldItem.id);
  });

  const normalItems = rawItems.filter((item) => !idsInPendingPairs.has(item.id)).map(toData);

  return (
    <PageShell title="经历库" subtitle="把简历背后的细节整理成可复用资产，AI 只能基于这里的内容改写简历">
      {pendingPairs.length > 0 ? (
        <Panel>
          <PanelHeader
            title="待确认的更新"
            subtitle="新提取的经历和库里已有的内容不一样，选择要保留哪一份"
            action={<span className="text-muted text-sm">{pendingPairs.length} 组</span>}
          />
          <div className="grid gap-3.5 p-4">
            {pendingPairs.map((pair) => (
              <DuplicatePairCard key={pair.newItem.id} oldItem={pair.oldItem} newItem={pair.newItem} />
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="经历条目"
          subtitle="上传或粘贴简历后自动提取，完全重复的内容不会重复入库；点击「编辑」可以手动修改标题、正文、标签"
          action={<span className="text-muted text-sm">共 {normalItems.length} 条</span>}
        />
        {normalItems.length === 0 && pendingPairs.length === 0 ? (
          <div className="p-4 text-muted text-sm">
            还没有经历条目，先去<span className="text-teal-dark">简历库</span>上传或粘贴一份简历，系统会自动提取。
          </div>
        ) : (
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-3.5 p-4">
            {normalItems.map((item) => (
              <ExperienceCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
