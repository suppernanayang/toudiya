import { EXPERIENCE_CATEGORIES } from "@/lib/experience-categories";

interface ExperienceItemLike {
  experienceType: string;
  title: string;
  organization: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  summary: string | null;
  skills: unknown;
}

function formatEntryHeader(item: ExperienceItemLike): string {
  const orgRole = [item.organization, item.role].filter(Boolean).join(" · ") || item.title;
  const period = [item.startDate, item.endDate].filter(Boolean).join(" - ");
  return period ? `${orgRole} | ${period}` : orgRole;
}

function formatBullets(item: ExperienceItemLike): string[] {
  if (item.experienceType === "skill") {
    const skills = Array.isArray(item.skills) ? (item.skills as string[]) : [];
    if (skills.length > 0) return [skills.join("、")];
    return item.summary ? [item.summary] : [];
  }
  return item.summary ? [item.summary] : [];
}

/**
 * 从经历库的结构化数据，按经历库同样的 5 个分类分组，拼出一份严格遵守
 * PDF 导出排版约定（## 分区标题 + 机构·角色｜时间 + - 要点）的简历正文。
 * 不调用 AI，纯程序拼装——零成本、瞬间完成、不会有事实风险。
 */
export function buildFormattedResumeContent(items: ExperienceItemLike[], fallbackRawText?: string | null): string {
  if (items.length === 0) {
    const raw = (fallbackRawText || "").trim();
    if (!raw) return "";
    return `## 简历内容\n${raw}`;
  }

  const sections: string[] = [];

  for (const category of EXPERIENCE_CATEGORIES) {
    const categoryItems = items.filter((item) => category.types.includes(item.experienceType as never));
    if (categoryItems.length === 0) continue;

    const lines: string[] = [`## ${category.label}`];
    for (const item of categoryItems) {
      if (item.experienceType === "skill") {
        lines.push(item.title);
      } else {
        lines.push(formatEntryHeader(item));
      }
      for (const bullet of formatBullets(item)) {
        lines.push(`- ${bullet}`);
      }
    }
    sections.push(lines.join("\n"));
  }

  const categorizedTypes = new Set(EXPERIENCE_CATEGORIES.flatMap((c) => c.types as string[]));
  const uncategorized = items.filter((item) => !categorizedTypes.has(item.experienceType));
  if (uncategorized.length > 0) {
    const lines: string[] = ["## 其他"];
    for (const item of uncategorized) {
      lines.push(formatEntryHeader(item));
      for (const bullet of formatBullets(item)) lines.push(`- ${bullet}`);
    }
    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}
