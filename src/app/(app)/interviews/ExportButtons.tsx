"use client";

import { useState } from "react";

export function ExportButtons({ content, filename }: { content: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      window.prompt("复制失败，请手动全选下面内容复制：", content);
    }
  }

  function handleDownload() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="min-h-9 rounded-lg border border-line text-sm px-3"
      >
        {copied ? "已复制 ✓" : "复制全部内容"}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="min-h-9 rounded-lg border border-line text-sm px-3"
      >
        下载为 Markdown
      </button>
    </div>
  );
}
