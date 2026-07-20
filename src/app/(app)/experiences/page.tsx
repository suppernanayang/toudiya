import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EXPERIENCE_CATEGORIES, getCategoryForType } from "@/lib/experience-categories";
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

  // 按分类分组，分类顺序、每个分类包含哪些底层 experienceType 见 experience-categories.ts
  const grouped = EXPERIENCE_CATEGORIES.map((category) => ({
    category,
    items: normalItems.filter((item) => category.types.includes(item.experienceType as never)),
  }));

  const uncategorized = normalItems.filter((item) => !getCategoryForType(item.experienceType));

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

      {normalItems.length === 0 && pendingPairs.length === 0 ? (
        <Panel>
          <div className="p-4 text-muted text-sm">
            还没有经历条目，先去<span className="text-teal-dark">简历库</span>上传或粘贴一份简历，系统会自动提取。
          </div>
        </Panel>
      ) : (
        grouped.map(({ category, items }) => (
          <Panel key={category.key}>
            <PanelHeader
              title={category.label}
              action={<span className="text-muted text-sm">{items.length} 条</span>}
            />
            {items.length === 0 ? (
              <div className="p-4 text-muted text-sm">这个分类下还没有内容。</div>
            ) : (
              <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-3.5 p-4">
                {items.map((item) => (
                  <ExperienceCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </Panel>
        ))
      )}

      {uncategorized.length > 0 ? (
        <Panel>
          <PanelHeader title="其他" subtitle="未归类的经历条目" action={<span className="text-muted text-sm">{uncategorized.length} 条</span>} />
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-3.5 p-4">
            {uncategorized.map((item) => (
              <ExperienceCard key={item.id} item={item} />
            ))}
          </div>
        </Panel>
      ) : null}
    </PageShell>
  );
}
