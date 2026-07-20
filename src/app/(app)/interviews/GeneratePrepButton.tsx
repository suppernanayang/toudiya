"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateInterviewPrep } from "./actions";

export function GeneratePrepButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await generateInterviewPrep(jobId);
            if (!result.ok) setError(result.message);
            else router.refresh();
          })
        }
        className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-teal bg-teal text-white w-fit"
      >
        {isPending ? "生成中…" : "生成面试准备材料"}
      </button>
      {error ? <p className="text-rose text-sm m-0">{error}</p> : null}
    </div>
  );
}
