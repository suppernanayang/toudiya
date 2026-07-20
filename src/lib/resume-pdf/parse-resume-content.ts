// 简历正文的排版约定解析器。
//
// 约定格式（对应 customize-resume.ts 里给 AI 的排版要求）：
//
// ## 分区标题
// 机构/学校名 · 角色/专业 | 起止时间
// - 要点一
// - 要点二
//
// ## 技能
// 纯文本列举，不需要严格遵守"机构 | 时间"这一行的格式
//
// 解析失败（比如完全没有分区标题）时返回 ok: false，
// 上层应该提示用户去审核台调整格式，而不是硬着头皮生成一份排版错乱的 PDF。

export interface ResumeEntry {
  header: string;
  date: string;
  bullets: string[];
}

export interface ResumeSection {
  title: string;
  entries: ResumeEntry[];
  bodyText?: string;
}

export interface ParsedResume {
  sections: ResumeSection[];
}

export type ParseResumeResult = { ok: true; data: ParsedResume } | { ok: false; reason: string };

function isBulletLine(line: string): boolean {
  return /^[-·*•]\s+/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[-·*•]\s+/, "").trim();
}

export function parseResumeContent(rawText: string): ParseResumeResult {
  const text = (rawText || "").trim();
  if (!text) {
    return { ok: false, reason: "简历内容是空的，没有可以导出的内容。" };
  }

  const lines = text.split("\n");
  const sections: ResumeSection[] = [];
  let current: ResumeSection | null = null;
  let currentEntry: ResumeEntry | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      current = { title: headingMatch[1].trim(), entries: [] };
      sections.push(current);
      currentEntry = null;
      continue;
    }

    if (!current) {
      // 分区标题之前出现了正文内容，不符合约定的排版格式。
      return {
        ok: false,
        reason:
          '简历正文缺少分区标题（比如"## 教育经历"），无法识别出结构，请先在审核台里按分区整理好格式再导出。',
      };
    }

    if (isBulletLine(line)) {
      const bulletText = stripBullet(line);
      if (!currentEntry) {
        currentEntry = { header: "", date: "", bullets: [] };
        current.entries.push(currentEntry);
      }
      currentEntry.bullets.push(bulletText);
      continue;
    }

    const pipeMatch = line.match(/^(.+?)\s*[|｜]\s*(.+)$/);
    if (pipeMatch) {
      currentEntry = { header: pipeMatch[1].trim(), date: pipeMatch[2].trim(), bullets: [] };
      current.entries.push(currentEntry);
      continue;
    }

    // 普通段落行：如果当前有条目就当作条目里的补充说明，否则当作分区级别的一段文字（比如"技能""自我评价"）。
    if (currentEntry) {
      currentEntry.bullets.push(line);
    } else {
      current.bodyText = current.bodyText ? `${current.bodyText}\n${line}` : line;
    }
  }

  if (sections.length === 0) {
    return {
      ok: false,
      reason: '没有识别到任何分区标题（比如"## 教育经历"），简历格式不符合导出要求，请先去审核台调整格式。',
    };
  }

  const hasContent = sections.some((s) => s.entries.length > 0 || s.bodyText);
  if (!hasContent) {
    return { ok: false, reason: "简历内容为空或格式无法识别，请检查审核台里的简历正文。" };
  }

  return { ok: true, data: { sections } };
}
