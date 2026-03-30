"use server";

import { db } from "@/lib/db";
import { fileExtractions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function getFileExtraction(fileId: string) {
  await requireAuth();

  const [extraction] = await db
    .select()
    .from(fileExtractions)
    .where(eq(fileExtractions.fileId, fileId))
    .limit(1);

  return extraction ?? null;
}
