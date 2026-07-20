"use client";

import { useState, useTransition } from "react";
import { exportResumeVersionPdf } from "./pdf-actions";

export function ExportPdfButton({ versionId }: { versionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await exportResumeVersionPdf(versionId);
            if (!result.ok) setError(result.message);
            else window.open(result.downloadUrl, "_blank");
          });
        }}
        className="text-teal-dark text-xs disabled:opacity-60"
      >
        {isPending ? "生成中…" : "导出 PDF"}
      </button>
      {error ? <p className="m-0 text-rose text-xs max-w-[220px]">{error}</p> : null}
    </div>
  );
}
