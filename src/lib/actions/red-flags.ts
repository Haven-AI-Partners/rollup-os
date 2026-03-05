"use server";

import { db } from "@/lib/db";
import { dealRedFlags, dealActivityLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

export async function getRedFlagsForDeal(dealId: string) {
  return db
    .select()
    .from(dealRedFlags)
    .where(eq(dealRedFlags.dealId, dealId))
    .orderBy(dealRedFlags.createdAt);
}

export async function addRedFlag(
  dealId: string,
  portcoId: string,
  portcoSlug: string,
  data: {
    flagId: string;
    severity: "critical" | "serious" | "moderate" | "info_gap";
    category: string;
    notes?: string;
  }
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [flag] = await db
    .insert(dealRedFlags)
    .values({
      dealId,
      portcoId,
      flagId: data.flagId,
      severity: data.severity,
      category: data.category,
      notes: data.notes,
      flaggedBy: user.id,
    })
    .returning();

  await db.insert(dealActivityLog).values({
    dealId,
    portcoId,
    userId: user.id,
    action: "status_changed",
    description: `Flagged red flag: ${data.flagId} (${data.severity})`,
  });

  revalidatePath(`/${portcoSlug}/deals/${dealId}`);
  return flag;
}

export async function resolveRedFlag(
  flagRecordId: string,
  portcoSlug: string,
  dealId: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [updated] = await db
    .update(dealRedFlags)
    .set({ resolved: true, resolvedAt: new Date(), resolvedBy: user.id })
    .where(eq(dealRedFlags.id, flagRecordId))
    .returning();

  revalidatePath(`/${portcoSlug}/deals/${dealId}`);
  return updated;
}

export async function unresolveRedFlag(
  flagRecordId: string,
  portcoSlug: string,
  dealId: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [updated] = await db
    .update(dealRedFlags)
    .set({ resolved: false, resolvedAt: null, resolvedBy: null })
    .where(eq(dealRedFlags.id, flagRecordId))
    .returning();

  revalidatePath(`/${portcoSlug}/deals/${dealId}`);
  return updated;
}

export async function removeRedFlag(
  flagRecordId: string,
  portcoSlug: string,
  dealId: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await db.delete(dealRedFlags).where(eq(dealRedFlags.id, flagRecordId));
  revalidatePath(`/${portcoSlug}/deals/${dealId}`);
}
