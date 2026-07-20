"use client";

import { useState, useTransition } from "react";
import { Tag, TagVariant } from "@/components/ui/Tag";
import { EXPERIENCE_TYPE_LABEL } from "@/lib/experience-categories";
import { deleteExperienceItem, updateExperienceItem } from "./actions";

export interface ExperienceItemData {
  id: string;
  experienceType: string;
  title: string;
  organization: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  summary: string | null;
  tags: string[];
  evidenceStatus: string;
  resumeSourceName: string | null;
}

const EVIDENCE_LABEL: Record<string, { label: string; variant: TagVariant }> = {
  confirmed: { label: "已确认", variant: "green" },
  needs_confirmation: { label: "待确认", variant: "amber" },
  incomplete: { label: "信息不完整", variant: "amber" },
};

export function ExperienceCard({ item }: { item: ExperienceItemData }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(item.title);
  const [organization, setOrganization] = useState(item.organization || "");
  const [role, setRole] = useState(item.role || "");
  const [startDate, setStartDate] = useState(item.startDate || "");
  const [endDate, setEndDate] = useState(item.endDate || "");
  const [summary, setSummary] = useState(item.summary || "");
  const [tagsText, setTagsText] = useState(item.tags.join("、"));

  const evidence = EVIDENCE_LABEL[item.evidenceStatus] || { label: item.evidenceStatus, variant: "default" as TagVariant };

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateExperienceItem(item.id, {
        title,
        organization,
        role,
        startDate,
        endDate,
        summary,
        tags: tagsText
          .split(/[、,，]/)
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (!result.ok) setError(result.message);
      else setEditing(false);
    });
  }

  function handleDelete() {
    if (!window.confirm("确定要删除这条经历吗？删除后不可恢复。")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteExperienceItem(item.id);
      if (!result.ok) setError(result.message);
    });
  }

  if (editing) {
    return (
      <div className="border border-teal rounded-lg bg-white p-3.5 grid gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" className="h-8 border border-line rounded-lg px-2 text-sm" />
          <input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="机构/公司" className="h-8 border border-line rounded-lg px-2 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="角色" className="h-8 border border-line rounded-lg px-2 text-sm" />
          <input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="开始时间" className="h-8 border border-line rounded-lg px-2 text-sm" />
          <input value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="结束时间" className="h-8 border border-line rounded-lg px-2 text-sm" />
        </div>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="经历描述" className="min-h-20 border border-line rounded-lg px-2 py-1.5 text-sm" />
        <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="标签，用顿号或逗号分隔" className="h-8 border border-line rounded-lg px-2 text-sm" />
        {error ? <p className="m-0 text-rose text-xs">{error}</p> : null}
        <div className="flex gap-2">
          <button type="button" disabled={isPending} onClick={handleSave} className="min-h-8 rounded-lg border border-teal bg-teal text-white text-xs px-3 disabled:opacity-60">
            {isPending ? "保存中…" : "保存"}
          </button>
          <button type="button" disabled={isPending} onClick={() => setEditing(false)} className="min-h-8 rounded-lg border border-line text-xs px-3">
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-line rounded-lg bg-white p-3.5 grid gap-2">
      <div className="flex items-start justify-between gap-2">
        <strong className="text-sm">{item.title}</strong>
        <Tag variant={evidence.variant}>{evidence.label}</Tag>
      </div>
      <span className="text-muted text-xs">
        {EXPERIENCE_TYPE_LABEL[item.experienceType] || item.experienceType}
        {item.organization ? ` · ${item.organization}` : ""}
        {item.startDate || item.endDate ? ` · ${item.startDate || "?"} - ${item.endDate || "?"}` : ""}
      </span>
      {item.summary ? <p className="m-0 text-muted text-sm leading-relaxed">{item.summary}</p> : null}
      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <span className="text-soft text-xs">来源简历：{item.resumeSourceName || "-"}</span>
        <div className="flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-teal-dark text-xs">
            编辑
          </button>
          <button type="button" disabled={isPending} onClick={handleDelete} className="text-rose text-xs disabled:opacity-60">
            删除
          </button>
        </div>
      </div>
      {error ? <p className="m-0 text-rose text-xs">{error}</p> : null}
    </div>
  );
}
