import { cache } from "react";
import { db } from "@/lib/db";
import { deals, pipelineStages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Cached deal fetch — deduplicated across layout + tab pages within a single request */
export const getDeal = cache(async (dealId: string) => {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  return deal ?? null;
});

/** Cached stage fetch — deduplicated when layout and tabs both need it */
export const getStage = cache(async (stageId: string) => {
  const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, stageId)).limit(1);
  return stage ?? null;
});
