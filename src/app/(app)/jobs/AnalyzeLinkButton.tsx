"use client";

import { useFormStatus } from "react-dom";

export function AnalyzeLinkButton({ hasJd }: { hasJd: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !hasJd}
      className="text-teal-dark text-sm underline-offset-2 hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "分析中…" : hasJd ? "开始分析" : "先补充 JD 正文"}
    </button>
  );
}
