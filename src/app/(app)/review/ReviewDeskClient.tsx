"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Tag, TagVariant } from "@/components/ui/Tag";
import {
  decideReviewItem,
  generateAiDraft,
  generateMessageDraft,
  saveEditedVersion,
  setFinalVersion,
  updateApplicationMessage,
  uploadFinalVersion,
} from "./actions";

export interface QueueItem {
  jobId: string;
  company: string;
  title: string;
  city: string | null;
  status: string;
  decision: string;
  summary: string | null;
  keywords: string[];
}

interface VersionSummary {
  id: string;
  versionName: string;
  versionType: string;
  contentText: string | null;
  filePath: string | null;
}

interface AiDraftVersionSummary extends VersionSummary {
  changeSummary: { title: string; detail: string }[];
  riskNotes: string[];
  pendingConfirmations: string[];
}

export interface ReviewDetail {
  jobId: string;
  company: string;
  title: string;
  jdRawText: string | null;
  status: string;
  summary: string | null;
  keywords: string[];
  hardRequirements: string[];
  riskFlags: string[];
  reviewItemId: string;
  decision: string;
  applicationMessage: string | null;
  finalResumeVersionId: string | null;
  currentSelectedResumeVersionId: string | null;
  recommendedVersion: VersionSummary | null;
  aiDraftVersion: AiDraftVersionSummary | null;
  currentVersion: VersionSummary | null;
  finalVersion: VersionSummary | null;
}

const DECISION_LABEL: Record<string, { label: string; variant: TagVariant }> = {
  undecided: { label: "待处理", variant: "amber" },
  apply: { label: "已投递", variant: "green" },
  pause: { label: "已暂缓", variant: "default" },
  skip: { label: "已不投", variant: "rose" },
  favorite: { label: "已收藏", variant: "blue" },
};

const VERSION_TYPE_LABEL: Record<string, string> = {
  original: "原始版",
  direction: "方向简历",
  ai_draft: "AI 草稿",
  platform_edited: "平台内编辑版",
  user_uploaded_final: "用户上传最终版",
  submitted_final: "已投递最终版",
};

export function ReviewDeskClient({ queue, detail }: { queue: QueueItem[]; detail: ReviewDetail | null }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,380px)_minmax(420px,1fr)] gap-4.5 items-start">
      <section className="bg-surface border border-line rounded-lg shadow-[var(--shadow-panel)]">
        <div className="px-4 pt-4 pb-3 border-b border-line">
          <h2 className="m-0 text-base font-semibold">岗位队列</h2>
          <span className="text-muted text-sm">按导入时间排序</span>
        </div>
        <div className="grid">
          {queue.length === 0 ? (
            <div className="p-4 text-muted text-sm">还没有已分析的岗位，先去岗位池导入并分析一个 JD。</div>
          ) : (
            queue.map((item) => {
              const decisionInfo = DECISION_LABEL[item.decision] || DECISION_LABEL.undecided;
              const active = detail?.jobId === item.jobId;
              return (
                <Link
                  key={item.jobId}
                  href={`/review?job=${item.jobId}`}
                  className={`block border-b border-line last:border-b-0 px-4 py-3.5 text-left ${active ? "bg-surface-2" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="text-sm overflow-wrap-anywhere">
                        {item.company} · {item.title}
                      </strong>
                      <div className="text-muted text-sm mt-1">{item.city || "城市待补充"}</div>
                    </div>
                    <Tag variant={decisionInfo.variant}>{decisionInfo.label}</Tag>
                  </div>
                  {item.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {item.keywords.slice(0, 3).map((kw) => (
                        <Tag key={kw} variant="blue">
                          {kw}
                        </Tag>
                      ))}
                    </div>
                  ) : null}
                </Link>
              );
            })
          )}
        </div>
      </section>

      {detail ? <ReviewDetailPanel detail={detail} /> : <EmptyDetail />}
    </div>
  );
}

function EmptyDetail() {
  return (
    <section className="bg-surface border border-line rounded-lg shadow-[var(--shadow-panel)] p-6 text-muted text-sm">
      左侧选择一个岗位查看审核详情。
    </section>
  );
}

function ReviewDetailPanel({ detail }: { detail: ReviewDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editText, setEditText] = useState(detail.currentVersion?.contentText || "");
  const [message, setMessage] = useState(detail.applicationMessage || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // detail 变化时（切换岗位）同步本地编辑状态
  const [loadedJobId, setLoadedJobId] = useState(detail.jobId);
  if (loadedJobId !== detail.jobId) {
    setLoadedJobId(detail.jobId);
    setEditText(detail.currentVersion?.contentText || "");
    setMessage(detail.applicationMessage || "");
    setError(null);
  }

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message || "操作失败");
      } else {
        router.refresh();
      }
    });
  }

  const versions = [
    detail.recommendedVersion ? { ...detail.recommendedVersion, role: "基准" } : null,
    detail.aiDraftVersion ? { ...detail.aiDraftVersion, role: null } : null,
  ].filter(Boolean) as (VersionSummary & { role: string | null })[];

  const decisionInfo = DECISION_LABEL[detail.decision] || DECISION_LABEL.undecided;

  return (
    <section className="bg-surface border border-line rounded-lg shadow-[var(--shadow-panel)] grid">
      <div className="p-4.5 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line">
        <div>
          <h2 className="m-0 text-xl font-semibold leading-snug">
            {detail.company} · {detail.title}
          </h2>
          <p className="mt-2 mb-0 text-muted text-sm">{detail.summary || "还没有 JD 分析摘要"}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Tag variant={decisionInfo.variant}>{decisionInfo.label}</Tag>
            {detail.keywords.slice(0, 4).map((kw) => (
              <Tag key={kw} variant="blue">
                {kw}
              </Tag>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-4.5 mt-4 border border-rose-soft bg-rose-soft text-rose rounded-lg px-3 py-2 text-sm">{error}</div>
      ) : null}

      <div className="p-4.5 grid grid-cols-1 lg:grid-cols-[minmax(260px,0.9fr)_minmax(340px,1.1fr)] gap-4.5">
        <div className="grid gap-3 content-start">
          <SectionTitle title="简历版本" subtitle={detail.finalResumeVersionId ? "已设最终版" : "最终版未确认"} />
          <div className="grid gap-2.5">
            {versions.map((v) => (
              <VersionCard
                key={v.id}
                version={v}
                active={detail.currentSelectedResumeVersionId === v.id}
                isFinal={detail.finalResumeVersionId === v.id}
              />
            ))}
            {!detail.aiDraftVersion ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => generateAiDraft(detail.jobId))}
                className="min-h-9 rounded-lg border border-teal bg-teal text-white text-sm"
              >
                {isPending ? "生成中…" : "生成岗位定制简历（AI 草稿）"}
              </button>
            ) : null}
            <div className="border border-line rounded-lg p-3 grid gap-2">
              <div className="flex items-center justify-between">
                <strong className="text-sm">外部回传最终版</strong>
                <span className="text-muted text-xs">{detail.finalVersion?.versionType === "user_uploaded_final" ? "已上传" : "未上传"}</span>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="text-sm" />
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const file = fileInputRef.current?.files?.[0];
                  if (!file) {
                    setError("请先选择要上传的文件。");
                    return;
                  }
                  run(() => uploadFinalVersion(detail.reviewItemId, detail.jobId, file));
                }}
                className="min-h-8 rounded-lg border border-line text-sm"
              >
                下载后修改模板，再把最终文件上传到这里
              </button>
            </div>
          </div>

          {detail.aiDraftVersion ? (
            <>
              <SectionTitle title="修改说明" subtitle={`${detail.aiDraftVersion.changeSummary.length} 处关键调整`} />
              <div className="grid gap-2.5">
                {detail.aiDraftVersion.changeSummary.map((c, idx) => (
                  <div key={idx} className="border-l-[3px] border-teal bg-[#f8fbfa] px-3 py-2.5 rounded-r-lg">
                    <strong className="block text-sm mb-1">{c.title}</strong>
                    <p className="m-0 text-muted text-sm leading-relaxed">{c.detail}</p>
                  </div>
                ))}
                {detail.aiDraftVersion.riskNotes.map((note, idx) => (
                  <div key={idx} className="border-l-[3px] border-amber bg-amber-soft/40 px-3 py-2.5 rounded-r-lg">
                    <strong className="block text-sm mb-1">风险提醒</strong>
                    <p className="m-0 text-muted text-sm leading-relaxed">{note}</p>
                  </div>
                ))}
                {detail.aiDraftVersion.pendingConfirmations.map((q, idx) => (
                  <div key={idx} className="border-l-[3px] border-amber bg-[#fffaf0] px-3 py-2.5 rounded-r-lg">
                    <strong className="block text-sm mb-1">待确认</strong>
                    <p className="m-0 text-muted text-sm leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="grid gap-3 content-start">
          <SectionTitle title="简历预览与编辑" subtitle="保存会生成新的平台内编辑版" />
          <div className="border border-line rounded-lg bg-[#fbfcfc] overflow-hidden">
            <div className="min-h-[42px] px-2.5 flex items-center justify-between border-b border-line bg-white">
              <Tag variant="teal">{detail.currentVersion ? VERSION_TYPE_LABEL[detail.currentVersion.versionType] : "无版本"}</Tag>
              {detail.currentVersion?.filePath ? (
                <a href={`/api/files/${encodeURIComponent(detail.currentVersion.filePath)}`} className="text-teal-dark text-xs">
                  下载当前版本
                </a>
              ) : null}
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-[280px] p-4 leading-relaxed outline-none"
              placeholder={detail.currentVersion ? "" : "还没有简历版本，先在左侧生成 AI 定制简历，或从简历库关联一份基准简历。"}
            />
          </div>
          <div>
            <button
              type="button"
              disabled={isPending || !editText.trim()}
              onClick={() => run(() => saveEditedVersion(detail.reviewItemId, detail.jobId, editText))}
              className="min-h-9 rounded-lg border border-line text-sm px-3"
            >
              保存为平台内编辑版
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-line p-4.5 grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_minmax(240px,320px)] gap-4">
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <label className="text-muted text-sm">投递话术</label>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => generateMessageDraft(detail.jobId))}
              className="text-teal-dark text-xs"
            >
              AI 生成话术
            </button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => run(() => updateApplicationMessage(detail.reviewItemId, message, detail.jobId))}
            className="min-h-28 border border-line rounded-lg bg-white p-3 leading-relaxed"
          />
        </div>
        <div className="grid gap-2.5 content-start">
          <Row label="最终简历" value={detail.finalVersion ? VERSION_TYPE_LABEL[detail.finalVersion.versionType] : "未设置"} />
          <Row label="待确认事实" value={`${detail.aiDraftVersion?.pendingConfirmations.length || 0} 项`} warn={(detail.aiDraftVersion?.pendingConfirmations.length || 0) > 0} />
          <button
            type="button"
            disabled={isPending || !detail.currentSelectedResumeVersionId}
            onClick={() =>
              detail.currentSelectedResumeVersionId &&
              run(() => setFinalVersion(detail.reviewItemId, detail.currentSelectedResumeVersionId!, detail.jobId))
            }
            className="min-h-9 rounded-lg border border-[#f3d38a] bg-amber-soft text-[#7c3b07] text-sm"
          >
            设为最终投递版
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => decideReviewItem(detail.reviewItemId, detail.jobId, "apply"))}
              className="min-h-9 rounded-lg border border-teal bg-teal text-white text-sm"
            >
              投递
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => decideReviewItem(detail.reviewItemId, detail.jobId, "pause"))}
              className="min-h-9 rounded-lg border border-line text-sm"
            >
              暂缓
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => decideReviewItem(detail.reviewItemId, detail.jobId, "skip"))}
              className="min-h-9 rounded-lg border border-line text-sm"
            >
              不投
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="m-0 text-sm text-[#31413d]">{title}</h3>
      {subtitle ? <span className="text-muted text-xs">{subtitle}</span> : null}
    </div>
  );
}

function VersionCard({
  version,
  active,
  isFinal,
}: {
  version: VersionSummary & { role: string | null };
  active: boolean;
  isFinal: boolean;
}) {
  return (
    <div className={`border rounded-lg p-3 grid gap-2 bg-white ${active ? "border-teal bg-[#f0faf6]" : "border-line"}`}>
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm overflow-wrap-anywhere">{version.versionName}</strong>
        <span className="text-muted text-xs whitespace-nowrap">{version.role || (active ? "当前" : "")}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Tag variant={version.versionType === "ai_draft" ? "teal" : "default"}>{VERSION_TYPE_LABEL[version.versionType]}</Tag>
        {isFinal ? <Tag variant="green">最终投递版</Tag> : null}
      </div>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <strong className={warn ? "text-amber" : undefined}>{value}</strong>
    </div>
  );
}
