"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { getResumePdfPreviewData, exportResumeVersionPdf, type ResumePdfPreviewData } from "@/app/(app)/resumes/pdf-actions";
import { ResumeDocument, MIN_RESUME_SCALE, MAX_RESUME_SCALE } from "@/lib/resume-pdf/ResumeDocument";
import { parseResumeContent } from "@/lib/resume-pdf/parse-resume-content";
import { registerResumeFontsForBrowser } from "@/lib/resume-pdf/fonts-client";

// PDFViewer 依赖浏览器环境（内部用 pdf.js 渲染），不能在服务端渲染，
// 所以要用 next/dynamic + ssr:false 动态加载，跟 @react-pdf/renderer 官方示例做法一致。
const PDFViewer = dynamic(() => import("@react-pdf/renderer").then((mod) => mod.PDFViewer), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">加载预览组件中…</div>,
});

// 浏览器端字体注册要放进 useEffect，不能放在模块顶层：
// 这个文件虽然是 "use client"，但被服务端组件（比如 resumes/page.tsx）引用时，
// Next.js 在服务端渲染阶段也会执行一遍这个模块，如果在模块顶层调用，
// 会在 Node 进程里用"浏览器 URL 版"的字体配置覆盖掉服务端导出用的"文件路径版"配置
// （两者共用同一个 @react-pdf/renderer 全局 Font 注册表），
// 导致真正导出 PDF 时去文件系统找一个叫 "/fonts/xxx.otf" 的文件从而报错。
// useEffect 只在浏览器真正挂载后才会跑，天然不会在服务端渲染阶段执行。

export function ResumePdfPreviewButton({ versionId, label = "预览并导出" }: { versionId: string; label?: string }) {
  useEffect(() => {
    registerResumeFontsForBrowser();
  }, []);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<ResumePdfPreviewData | null>(null);
  const [scale, setScale] = useState(1);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  const openPreview = async () => {
    setLoadError(null);
    setExportError(null);
    setExportWarning(null);
    setLoading(true);
    const result = await getResumePdfPreviewData(versionId);
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.message);
      return;
    }
    setData(result.data);
    setScale(1);
    setOpen(true);
  };

  const parsed = useMemo(() => (data ? parseResumeContent(data.contentText) : null), [data]);

  const doExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportWarning(null);
    const result = await exportResumeVersionPdf(versionId, scale);
    setExporting(false);
    if (!result.ok) {
      setExportError(result.message);
      return;
    }
    if (result.warning) setExportWarning(result.warning);
    window.open(result.downloadUrl, "_blank");
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={openPreview}
        className="text-teal-dark text-xs whitespace-nowrap disabled:opacity-60"
      >
        {loading ? "加载预览中…" : label}
      </button>
      {loadError ? <p className="m-0 text-rose text-xs max-w-[220px]">{loadError}</p> : null}

      {open && data ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-panel">
            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <h3 className="m-0 text-sm font-bold">PDF 导出预览</h3>
                <p className="m-0 text-xs text-muted">
                  跟实际导出用的是同一套渲染引擎，这里看到的效果和导出结果完全一致。
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-muted text-xs whitespace-nowrap">
                关闭
              </button>
            </div>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-4 border-b border-line px-4 py-3">
              <label className="flex items-center gap-2 text-xs text-muted">
                字号/间距
                <input
                  type="range"
                  min={MIN_RESUME_SCALE}
                  max={MAX_RESUME_SCALE}
                  step={0.01}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-40"
                />
                <span className="w-10 text-right">{Math.round(scale * 100)}%</span>
              </label>
              <button
                type="button"
                onClick={() => setScale(1)}
                disabled={scale === 1}
                className="text-teal-dark text-xs disabled:opacity-40"
              >
                恢复默认
              </button>
              <div className="ml-auto flex items-center gap-3">
                {exportError ? <p className="m-0 text-rose text-xs max-w-[260px]">{exportError}</p> : null}
                <button
                  type="button"
                  disabled={exporting || !parsed?.ok}
                  onClick={doExport}
                  className="min-h-8 rounded-lg border border-line px-3 text-sm disabled:opacity-60"
                >
                  {exporting ? "导出中…" : "确认导出"}
                </button>
              </div>
            </div>

            {exportWarning ? (
              <div className="flex-shrink-0 bg-amber-soft px-4 py-2 text-xs text-amber">{exportWarning}</div>
            ) : null}

            <div className="min-h-0 flex-1 bg-surface-2">
              {parsed?.ok ? (
                <PDFViewer style={{ width: "100%", height: "100%", border: "none" }} showToolbar>
                  <ResumeDocument
                    name={data.name}
                    subtitle={data.subtitle}
                    contactLine={data.contactLine}
                    avatarPath={data.avatarUrl}
                    resume={parsed.data}
                    scale={scale}
                  />
                </PDFViewer>
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-rose">
                  {parsed?.reason}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
