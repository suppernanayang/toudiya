"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type ApplicationStatus =
  | "submitted"
  | "waiting"
  | "interview_invited"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "closed";

export async function updateApplicationStatus(applicationId: string, status: ApplicationStatus) {
  await prisma.application.update({
    where: { id: applicationId },
    data: { currentStatus: status },
  });
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  return { ok: true } as const;
}
