// 经历库的分类体系。数据库里 experienceType 字段本身还是细粒度的 8 种类型
// （不改动，兼容老数据），这里只是定义"页面上按哪几个大类分组展示"的映射关系。

export type ExperienceType =
  | "education"
  | "internship"
  | "project"
  | "campus"
  | "work"
  | "certificate"
  | "award"
  | "portfolio"
  | "skill";

export const EXPERIENCE_TYPE_LABEL: Record<string, string> = {
  education: "教育经历",
  internship: "实习经历",
  project: "项目经历",
  campus: "校园经历",
  work: "工作经历",
  certificate: "证书",
  award: "奖项",
  portfolio: "作品",
  skill: "技能",
};

export interface ExperienceCategory {
  key: string;
  label: string;
  types: ExperienceType[];
}

// 展示顺序也是这个数组的顺序，跟简历里常见的分区顺序保持一致。
export const EXPERIENCE_CATEGORIES: ExperienceCategory[] = [
  { key: "education", label: "教育背景", types: ["education"] },
  { key: "work", label: "实习经历 / 工作经历", types: ["internship", "work"] },
  { key: "project", label: "项目经历", types: ["project", "portfolio"] },
  { key: "campus", label: "校园经历", types: ["campus"] },
  { key: "honor", label: "荣誉与技能", types: ["certificate", "award", "skill"] },
];

export function getCategoryForType(experienceType: string): ExperienceCategory | undefined {
  return EXPERIENCE_CATEGORIES.find((c) => c.types.includes(experienceType as ExperienceType));
}
