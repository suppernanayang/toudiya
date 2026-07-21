"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Tag, TagVariant } from "@/components/ui/Tag";
import { ResumePdfPreviewButton } from "@/components/resume-pdf/ResumePdfPreviewButton";
import { generateFormattedVersion, saveResumeSourceVersion, updateResumeSourceInfo } from "../actions";

export interface ResumeVersionSummary {
  id: string;
  versionName: string;
  versionType: string;
  contentText: string | null;
  filePath: string | null;
  jobId: string | null;
  createdAt: string;
}

export interface ResumeSourceDetail {
  id: string;
  name: string;
  targetRoleType: string | null;
  isDefault: boolean;
  experienceCount: number;
  versions: ResumeVersionSummary[];
}

const VERSION_TYPE_LABEL: Record<string, { label: string; variant: TagVariant }> = {
  original: { label: "原始版", variant: "default" },
  direction: { label: "方向简历", variant: "blue" },
  formatted: { label: "格式化版", variant: "teal" },
  ai_draft: { label: "AI 草稿", variant: "teal" },
  platform_edited: { label: "平台内编辑版", variant: "amber" },
  user_uploaded_final: { label: "用户上传最终版", variant: "green" },
  submitted_final: { label: "已投递最终版", variant: "green" },
};

export function ResumeSourceDetailClient({ detail }: { detail: ResumeSourceDetail }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(detail.versions[0]?.id ?? null);
  const [editText, setEditText] = useState(detail.versions[0]?.contentText || "");

  const selectedVersion = detail.versions.find((v) => v.id === selectedVersionId) || null;

  function selectVersion(version: ResumeVersionSummary) {
    setSelectedVersionId(version.id);
    setEditText(version.contentText || "");
    setError(null);
    setNotice(null);
  }

  function run(action: () => Promise<{ ok: boolean; message?: string }>, successNotice?: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message || "操作失败");
      } else {
        if (successNotice) setNotice(successNotice);
        else window.location.reload();
      }
    });
  }

  return (
    <div className="grid gap-4.5">
      <Panel>
        <PanelHeader title="基础信息" />
        <PersonalizedInfoForm detail={detail} />
      </Panel>

      {error ? (
        <div className="border border-rose-soft bg-rose-soft text-rose rounded-lg px-4 py-3 text-sm">{error}</div>
      ) : null}
      {notice ? (
        <div className="border border-[#bfe3cc] bg-[#e7f6ec] text-green rounded-lg px-4 py-3 text-sm">{notice}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-4.5 items-start">
        <Panel>
          <PanelHeader
            title="全部版本"
            subtitle={`共 ${detail.versions.length} 份，经历库 ${detail.experienceCount} 条`}
            action={
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => generateFormattedVersion(detail.id))}
                className="text-teal-dark text-xs whitespace-nowrap disabled:opacity-60"
              >
                重新生成格式化版本
              </button>
            }
          />
          <div className="grid gap-2.5 p-3">
            {detail.versions.length === 0 ? (
              <div className="p-2 text-muted text-sm">还没有任何版本。</div>
            ) : (
              detail.versions.map((v) => {
                const info = VERSION_TYPE_LABEL[v.versionType] || { label: v.versionType, variant: "default" as TagVariant };
                const active = v.id === selectedVersionId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVersion(v)}
                    className={`text-left border rounded-lg p-3 grid gap-2 bg-white ${
                      active ? "border-teal bg-[#f0faf6]" : "border-line hover:border-soft"
                    }`}
                  >
                    <strong className="text-sm [overflow-wrap:anywhere]">{v.versionName}</strong>
                    <div className="flex flex-wrap gap-1.5">
                      <Tag variant={info.variant}>{info.label}</Tag>
                      {v.jobId ? <Tag variant="blue">已绑定岗位</Tag> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="内容预览与编辑"
            subtitle="保存会生成新的格式化版本，不覆盖当前这份"
            action={
              selectedVersion ? (
                <div className="flex items-center gap-3">
                  {selectedVersion.filePath ? (
                    <a
                      href={`/api/files/${encodeURIComponent(selectedVersion.filePath)}`}
                      className="text-teal-dark text-xs whitespace-nowrap"
                    >
                      下载
                    </a>
                  ) : null}
                  <ResumePdfPreviewButton versionId={selectedVersion.id} />
                </div>
              ) : undefined
            }
          />
          <div className="p-4 grid gap-3">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-[420px] border border-line rounded-lg bg-white p-4 leading-relaxed box-border"
              placeholder={selectedVersion ? "" : "左边选一个版本查看内容"}
            />
            <div>
              <button
                type="button"
                disabled={isPending || !editText.trim()}
                onClick={() =>
                  run(
                    () => saveResumeSourceVersion(detail.id, editText),
                    "已保存为新的格式化版本，刷新页面后能在左侧列表看到。",
                  )
                }
                className="min-h-9 rounded-lg border border-line text-sm px-3 disabled:opacity-60"
              >
                保存为新版本
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PersonalizedInfoForm({ detail }: { detail: ResumeSourceDetail }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const result = await updateResumeSourceInfo(detail.id, {
      name: String(formData.get("name") || ""),
      targetRoleType: String(formData.get("targetRoleType") || ""),
      isDefault: formData.get("isDefault") === "on",
    });
    if (!result.ok) setError(result.message);
    else setSaved(true);
  }

  return (
    <form action={handleSubmit} className="p-4 grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <input
          name="name"
          type="text"
          defaultValue={detail.name}
          placeholder="简历名称"
          className="h-9 border border-line rounded-lg px-2.5 bg-white"
          required
        />
        <input
          name="targetRoleType"
          type="text"
          defaultValue={detail.targetRoleType || ""}
          placeholder="岗位方向标签"
          className="h-9 border border-line rounded-lg px-2.5 bg-white"
        />
        <label className="h-9 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="isDefault" defaultChecked={detail.isDefault} className="w-4 h-4 accent-teal" />
          设为该方向默认简历
        </label>
      </div>
      {error ? <p className="m-0 text-rose text-xs">{error}</p> : null}
      {saved ? <p className="m-0 text-green text-xs">已保存</p> : null}
      <div>
        <SaveInfoButton />
      </div>
    </form>
  );
}

function SaveInfoButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-line disabled:opacity-60"
    >
      {pending ? "保存中…" : "保存基础信息"}
    </button>
  );
}
