"use server";

import { db } from "@/lib/db";
import { portcos, gdriveApiErrors } from "@/lib/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function updateGdriveFolderId(
  portcoSlug: string,
  folderId: string | null
) {
  await requireAuth();

  await db
    .update(portcos)
    .set({ gdriveFolderId: folderId, updatedAt: new Date() })
    .where(eq(portcos.slug, portcoSlug));

  revalidatePath(`/${portcoSlug}/settings`);
}

export async function disconnectGdrive(portcoSlug: string) {
  await requireAuth();

  await db
    .update(portcos)
    .set({
      gdriveServiceAccountEnc: null,
      gdriveFolderId: null,
      updatedAt: new Date(),
    })
    .where(eq(portcos.slug, portcoSlug));

  revalidatePath(`/${portcoSlug}/settings`);
}

/** Fetch recent GDrive API errors for a portco (last 24 hours). */
export async function getRecentGdriveErrors(portcoId: string) {
  await requireAuth();

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return db
    .select({
      id: gdriveApiErrors.id,
      httpStatus: gdriveApiErrors.httpStatus,
      context: gdriveApiErrors.context,
      attempt: gdriveApiErrors.attempt,
      exhausted: gdriveApiErrors.exhausted,
      createdAt: gdriveApiErrors.createdAt,
    })
    .from(gdriveApiErrors)
    .where(
      and(
        eq(gdriveApiErrors.portcoId, portcoId),
        gte(gdriveApiErrors.createdAt, oneDayAgo),
      ),
    )
    .orderBy(desc(gdriveApiErrors.createdAt))
    .limit(20);
}
