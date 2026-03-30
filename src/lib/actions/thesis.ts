"use server";

import { db } from "@/lib/db";
import { dealThesisNodes } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePortcoRole, getPortcoBySlug } from "@/lib/auth";
import { createThesisTreeForDeal } from "@/lib/thesis/create-tree";

/** Server action: generate thesis tree (called from UI) */
export async function generateThesisTree(
  dealId: string,
  portcoId: string,
  portcoSlug: string,
) {
  await requirePortcoRole(portcoId, "analyst");
  const count = await createThesisTreeForDeal(dealId, portcoId);
  if (count === 0) throw new Error("Thesis tree already exists for this deal");
  revalidatePath(`/${portcoSlug}/pipeline/${dealId}/thesis`);
  return { count };
}

export async function updateThesisNode(
  nodeId: string,
  portcoSlug: string,
  dealId: string,
  data: {
    status?: "unknown" | "partial" | "complete" | "risk";
    value?: string | null;
    notes?: string | null;
    source?: "im_extracted" | "manual" | "agent_generated" | "interview" | null;
    sourceDetail?: string | null;
  },
) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) throw new Error("PortCo not found");
  await requirePortcoRole(portco.id, "analyst");

  await db
    .update(dealThesisNodes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(dealThesisNodes.id, nodeId));

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}/thesis`);
}

export async function addThesisNode(
  dealId: string,
  portcoId: string,
  portcoSlug: string,
  data: {
    parentId: string;
    label: string;
    description?: string;
    sortOrder?: number;
  },
) {
  await requirePortcoRole(portcoId, "analyst");

  const [node] = await db
    .insert(dealThesisNodes)
    .values({
      dealId,
      portcoId,
      parentId: data.parentId,
      label: data.label,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
      source: "manual",
    })
    .returning({ id: dealThesisNodes.id });

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}/thesis`);

  return node;
}

export async function removeThesisNode(
  nodeId: string,
  portcoSlug: string,
  dealId: string,
) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) throw new Error("PortCo not found");
  await requirePortcoRole(portco.id, "admin");

  // Only allow deleting non-template nodes
  const [node] = await db
    .select({ templateNodeId: dealThesisNodes.templateNodeId })
    .from(dealThesisNodes)
    .where(eq(dealThesisNodes.id, nodeId))
    .limit(1);

  if (node?.templateNodeId) {
    throw new Error("Cannot delete base template nodes");
  }

  // Delete node and all descendants recursively
  await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM deal_thesis_nodes WHERE id = ${nodeId}::uuid
      UNION ALL
      SELECT n.id FROM deal_thesis_nodes n
      INNER JOIN descendants d ON n.parent_id = d.id
    )
    DELETE FROM deal_thesis_nodes WHERE id IN (SELECT id FROM descendants)
  `);

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}/thesis`);
}
