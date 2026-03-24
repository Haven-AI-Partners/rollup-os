"use server";

import { db } from "@/lib/db";
import { portcos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
