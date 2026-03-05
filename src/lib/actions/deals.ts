"use server";

import { db } from "@/lib/db";
import {
  deals,
  pipelineStages,
  dealComments,
  dealTransfers,
  dealActivityLog,
} from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

export async function getDealsForPortco(portcoId: string) {
  return db
    .select()
    .from(deals)
    .where(eq(deals.portcoId, portcoId))
    .orderBy(asc(deals.kanbanPosition));
}

export async function getStagesForPortco(portcoId: string) {
  return db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.portcoId, portcoId))
    .orderBy(asc(pipelineStages.position));
}

export async function createDeal(
  portcoId: string,
  portcoSlug: string,
  data: {
    companyName: string;
    description?: string;
    stageId: string;
    source?: "agent_scraped" | "manual" | "broker_referral";
    askingPrice?: string;
    revenue?: string;
    ebitda?: string;
    location?: string;
    industry?: string;
    employeeCount?: number;
  }
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [deal] = await db
    .insert(deals)
    .values({
      portcoId,
      stageId: data.stageId,
      companyName: data.companyName,
      description: data.description,
      source: data.source ?? "manual",
      askingPrice: data.askingPrice,
      revenue: data.revenue,
      ebitda: data.ebitda,
      location: data.location,
      industry: data.industry,
      employeeCount: data.employeeCount,
      assignedTo: user.id,
    })
    .returning();

  await db.insert(dealActivityLog).values({
    dealId: deal.id,
    portcoId,
    userId: user.id,
    action: "deal_created",
    description: `Created deal "${data.companyName}"`,
  });

  revalidatePath(`/${portcoSlug}/deals`);
  revalidatePath(`/${portcoSlug}/dashboard`);
  return deal;
}

export async function updateDeal(
  dealId: string,
  portcoSlug: string,
  data: Partial<{
    companyName: string;
    description: string;
    stageId: string;
    status: "active" | "passed" | "closed_won" | "closed_lost";
    askingPrice: string;
    revenue: string;
    ebitda: string;
    location: string;
    industry: string;
    employeeCount: number;
    assignedTo: string;
    kanbanPosition: number;
  }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  // Get current deal for activity logging
  const [currentDeal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!currentDeal) throw new Error("Deal not found");

  const [updated] = await db
    .update(deals)
    .set({
      ...data,
      closedAt:
        data.status === "closed_won" || data.status === "closed_lost"
          ? new Date()
          : undefined,
      updatedAt: new Date(),
    })
    .where(eq(deals.id, dealId))
    .returning();

  // Log stage changes
  if (data.stageId && data.stageId !== currentDeal.stageId) {
    const [oldStage] = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.id, currentDeal.stageId))
      .limit(1);
    const [newStage] = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.id, data.stageId))
      .limit(1);

    await db.insert(dealActivityLog).values({
      dealId,
      portcoId: currentDeal.portcoId,
      userId: user.id,
      action: "stage_changed",
      description: `Moved from "${oldStage?.name}" to "${newStage?.name}"`,
      changes: { stageId: { old: currentDeal.stageId, new: data.stageId } },
    });
  }

  // Log status changes
  if (data.status && data.status !== currentDeal.status) {
    await db.insert(dealActivityLog).values({
      dealId,
      portcoId: currentDeal.portcoId,
      userId: user.id,
      action: "status_changed",
      description: `Status changed to "${data.status}"`,
      changes: { status: { old: currentDeal.status, new: data.status } },
    });
  }

  revalidatePath(`/${portcoSlug}/deals`);
  revalidatePath(`/${portcoSlug}/deals/${dealId}`);
  revalidatePath(`/${portcoSlug}/dashboard`);
  return updated;
}

export async function moveDealToStage(
  dealId: string,
  stageId: string,
  kanbanPosition: number,
  portcoSlug: string
) {
  return updateDeal(dealId, portcoSlug, { stageId, kanbanPosition });
}

export async function addComment(
  dealId: string,
  portcoId: string,
  portcoSlug: string,
  content: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [comment] = await db
    .insert(dealComments)
    .values({ dealId, userId: user.id, content })
    .returning();

  await db.insert(dealActivityLog).values({
    dealId,
    portcoId,
    userId: user.id,
    action: "comment_added",
    description: `Added a comment`,
    referenceType: "comment",
    referenceId: comment.id,
  });

  revalidatePath(`/${portcoSlug}/deals/${dealId}`);
  return comment;
}

export async function getComments(dealId: string) {
  return db
    .select()
    .from(dealComments)
    .where(eq(dealComments.dealId, dealId))
    .orderBy(asc(dealComments.createdAt));
}

export async function getActivityLog(dealId: string) {
  return db
    .select()
    .from(dealActivityLog)
    .where(eq(dealActivityLog.dealId, dealId))
    .orderBy(sql`${dealActivityLog.createdAt} DESC`);
}
