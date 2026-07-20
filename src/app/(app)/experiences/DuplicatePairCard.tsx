"use client";

import { useState, useTransition } from "react";
import { Tag } from "@/components/ui/Tag";
import { resolveDuplicateExperience } from "./actions";
import type { ExperienceItemData } from "./ExperienceCard";

export function DuplicatePairCard({ oldItem, newItem }: { oldItem: ExperienceItemData; newItem: ExperienceItemData }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  function resolve(choice: "keep_new" | "keep_old" | "keep_both") {
    setError(null);
    startTransition(async () => {
      const result = await resolveDuplicateExperience(newItem.id, oldItem.id, choice);
      if (!result.ok) setError(result.message);
      else setResolved(true);
    });
  }

  if (resolved) return null;

  return (
    <div className="border border-amber-soft bg-[#fffaf0] rounded-lg p-3.5 grid gap-3 col-span-full">
      <div className="flex items-center gap-2">
        <Tag variant="amber">内容有更新，待你确认</Tag>
        <span className="text-muted text-xs">「{oldItem.title}」在新简历里的内容和库里已有的不一样，选择要保留哪一份</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MiniCard label="库里已有的版本" item={oldItem} />
        <MiniCard label="这次新提取的版本" item={newItem} highlight />
      </div>
      {error ? <p className="m-0 text-rose text-xs">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("keep_new")}
          className="min-h-8 rounded-lg border border-teal bg-teal text-white text-xs px-3 disabled:opacity-60"
        >
          保留新的，删掉旧的
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("keep_old")}
          className="min-h-8 rounded-lg border border-line text-xs px-3 disabled:opacity-60"
        >
          保留旧的，删掉新的
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("keep_both")}
          className="min-h-8 rounded-lg border border-line text-xs px-3 disabled:opacity-60"
        >
          两条都保留（各自独立）
        </button>
      </div>
    </div>
  );
}

function MiniCard({ label, item, highlight }: { label: string; item: ExperienceItemData; highlight?: boolean }) {
  return (
    <div className={`border rounded-lg p-3 grid gap-1.5 bg-white ${highlight ? "border-teal" : "border-line"}`}>
      <span className="text-muted text-xs">{label}</span>
      <strong className="text-sm">{item.title}</strong>
      <span className="text-muted text-xs">
        {item.organization || "-"}
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
    </div>
  );
}
