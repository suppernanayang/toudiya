"use client";

import { useFormStatus } from "react-dom";

export function JobSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-teal bg-teal text-white disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "正在保存并分析，请稍候…" : "保存并分析"}
    </button>
  );
}
