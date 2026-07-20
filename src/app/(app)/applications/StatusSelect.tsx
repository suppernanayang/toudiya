"use client";

import { useTransition } from "react";
import { updateApplicationStatus, type ApplicationStatus } from "./actions";

const OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "submitted", label: "已投递" },
  { value: "waiting", label: "等待回复" },
  { value: "interview_invited", label: "已收到面试邀请" },
  { value: "interviewing", label: "面试中" },
  { value: "offer", label: "已 Offer" },
  { value: "rejected", label: "已拒绝" },
  { value: "withdrawn", label: "已撤回" },
  { value: "closed", label: "已关闭" },
];

export function StatusSelect({ applicationId, value }: { applicationId: string; value: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={value}
      disabled={isPending}
      onChange={(e) => {
        const status = e.target.value as ApplicationStatus;
        startTransition(async () => {
          await updateApplicationStatus(applicationId, status);
        });
      }}
      className="h-8 border border-line rounded-lg px-2 bg-white text-sm"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
