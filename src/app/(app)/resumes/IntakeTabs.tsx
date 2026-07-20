"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createResumeFromText, uploadResumeFile } from "./actions";

export function ResumeIntakeTabs() {
  const [tab, setTab] = useState<"paste" | "upload">("paste");

  return (
    <div>
      <div className="px-4 pt-3.5 flex gap-2">
        <TabButton active={tab === "paste"} onClick={() => setTab("paste")}>
          粘贴文本
        </TabButton>
        <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
          上传 PDF / Word
        </TabButton>
      </div>

      {tab === "paste" ? (
        <form action={createResumeFromText} className="p-4 grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              name="name"
              type="text"
              placeholder="简历名称，例如：产品运营方向简历"
              className="h-9 border border-line rounded-lg px-2.5 bg-white"
              required
            />
            <input
              name="targetRoleType"
              type="text"
              placeholder="岗位方向标签，例如：产品运营"
              className="h-9 border border-line rounded-lg px-2.5 bg-white"
            />
            <label className="h-9 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="setAsDefault" className="w-4 h-4 accent-teal" />
              设为该方向默认简历
            </label>
          </div>
          <textarea
            name="resumeText"
            placeholder="将简历文本粘贴到这里，系统会解析出经历条目并标记不确定信息"
            className="min-h-40 border border-line rounded-lg bg-white p-3 leading-relaxed"
            required
          />
          <div>
            <SubmitButton pendingText="正在解析，请稍候（AI 提取经历可能需要十几秒）…">解析并保存为原始版本</SubmitButton>
          </div>
        </form>
      ) : (
        <form action={uploadResumeFile} className="p-4 grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              name="name"
              type="text"
              placeholder="简历名称，例如：市场营销方向简历"
              className="h-9 border border-line rounded-lg px-2.5 bg-white"
              required
            />
            <input
              name="targetRoleType"
              type="text"
              placeholder="岗位方向标签，例如：市场营销"
              className="h-9 border border-line rounded-lg px-2.5 bg-white"
            />
            <label className="h-9 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="setAsDefault" className="w-4 h-4 accent-teal" />
              设为该方向默认简历
            </label>
          </div>
          <div className="border border-dashed border-[#b7c8c3] rounded-lg min-h-[110px] flex flex-col items-center justify-center gap-2 text-center bg-[#fbfdfc] p-3">
            <input type="file" name="file" accept=".pdf,.doc,.docx,.txt" required className="text-sm" />
            <span className="text-muted text-xs">支持 .pdf / .docx，解析失败时可改为粘贴文本</span>
          </div>
          <div>
            <SubmitButton pendingText="正在上传解析，请稍候…">上传并解析</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border rounded-full px-4 py-1.5 text-sm ${
        active ? "bg-teal border-teal text-white" : "bg-white border-line text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-teal bg-teal text-white disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? pendingText : children}
    </button>
  );
}
