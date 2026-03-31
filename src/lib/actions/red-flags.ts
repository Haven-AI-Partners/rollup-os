"use server";

import { db } from "@/lib/db";
import { deals, dealRedFlags, dealActivityLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePortcoRole } from "@/lib/auth";
import { addRedFlagSchema } from "./schemas";

export async function getRedFlagsForDeal(dealId: string) {
  const [deal] = await db
    .select({ id: deals.id, portcoId: deals.portcoId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!deal) throw new Error("Deal not found");
  await requirePortcoRole(deal.portcoId, "viewer");

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
  const { user } = await requirePortcoRole(portcoId, "analyst");
  const validated = addRedFlagSchema.parse(data);

  const [flag] = await db
    .insert(dealRedFlags)
    .values({
      dealId,
      portcoId,
      flagId: validated.flagId,
      severity: validated.severity,
      category: validated.category,
      notes: validated.notes,
      flaggedBy: user.id,
    })
    .returning();

  await db.insert(dealActivityLog).values({
    dealId,
    portcoId,
    userId: user.id,
    action: "red_flag_added",
    description: `Flagged red flag: ${data.flagId} (${data.severity})`,
  });

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
  return flag;
}

export async function resolveRedFlag(
  flagRecordId: string,
  portcoSlug: string,
  dealId: string
) {
  const [flag] = await db
    .select({ id: dealRedFlags.id, portcoId: dealRedFlags.portcoId })
    .from(dealRedFlags)
    .where(eq(dealRedFlags.id, flagRecordId))
    .limit(1);
  if (!flag) throw new Error("Red flag not found");
  const { user } = await requirePortcoRole(flag.portcoId, "analyst");

  const [updated] = await db
    .update(dealRedFlags)
    .set({ resolved: true, resolvedAt: new Date(), resolvedBy: user.id })
    .where(eq(dealRedFlags.id, flagRecordId))
    .returning();

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
  return updated;
}

export async function unresolveRedFlag(
  flagRecordId: string,
  portcoSlug: string,
  dealId: string
) {
  const [flag] = await db
    .select({ id: dealRedFlags.id, portcoId: dealRedFlags.portcoId })
    .from(dealRedFlags)
    .where(eq(dealRedFlags.id, flagRecordId))
    .limit(1);
  if (!flag) throw new Error("Red flag not found");
  await requirePortcoRole(flag.portcoId, "analyst");

  const [updated] = await db
    .update(dealRedFlags)
    .set({ resolved: false, resolvedAt: null, resolvedBy: null })
    .where(eq(dealRedFlags.id, flagRecordId))
    .returning();

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
  return updated;
}

export async function removeRedFlag(
  flagRecordId: string,
  portcoSlug: string,
  dealId: string
) {
  const [flag] = await db
    .select({ id: dealRedFlags.id, portcoId: dealRedFlags.portcoId })
    .from(dealRedFlags)
    .where(eq(dealRedFlags.id, flagRecordId))
    .limit(1);
  if (!flag) throw new Error("Red flag not found");
  await requirePortcoRole(flag.portcoId, "admin");

  await db.delete(dealRedFlags).where(eq(dealRedFlags.id, flagRecordId));
  revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
}
