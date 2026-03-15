"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { promptVersions, files, evalRuns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk";
import type { runEvalTask } from "@/trigger/im-processing";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";

async function requireAdmin(portcoSlug: string) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) throw new Error("PortCo not found");
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const role = await getUserPortcoRole(user.id, portco.id);
  if (!role || !hasMinRole(role as UserRole, "admin")) {
    throw new Error("Admin access required");
  }
  return { portco, user };
}

/**
 * Auto-trigger a 3x eval on the most recently processed file.
 * Called after prompt version changes to measure impact.
 */
async function autoTriggerEval(
  portcoId: string,
  portcoSlug: string,
  agentSlug: string,
  promptVersionId: string | null,
  promptVersionLabel: string,
  userId: string | null,
) {
  try {
    // Find the most recently processed file
    const [recentFile] = await db
      .select({ id: files.id, fileName: files.fileName })
      .from(files)
      .where(and(eq(files.portcoId, portcoId), eq(files.processingStatus, "completed")))
      .orderBy(desc(files.processedAt))
      .limit(1);

    if (!recentFile) return null;

    const { MODEL_ID } = await import("@/lib/agents/im-processor");

    const [evalRun] = await db
      .insert(evalRuns)
      .values({
        agentSlug,
        fileId: recentFile.id,
        fileName: recentFile.fileName,
        iterations: 3,
        status: "running",
        promptVersionId,
        promptVersionLabel,
        modelId: MODEL_ID,
        createdBy: userId,
      })
      .returning({ id: evalRuns.id });

    const handle = await tasks.trigger<typeof runEvalTask>("run-im-eval", {
      evalRunId: evalRun.id,
      fileId: recentFile.id,
      portcoId,
      iterations: 3,
    });

    return { evalRunId: evalRun.id, runId: handle.id };
  } catch {
    // Non-critical — don't fail the version change
    return null;
  }
}

/** Save a new prompt version and set it as active */
export async function savePromptVersion(
  portcoSlug: string,
  agentSlug: string,
  template: string,
  changeNote?: string,
) {
  const { portco, user } = await requireAdmin(portcoSlug);

  // Get the next version number
  const [latest] = await db
    .select({ version: promptVersions.version })
    .from(promptVersions)
    .where(eq(promptVersions.agentSlug, agentSlug))
    .orderBy(desc(promptVersions.version))
    .limit(1);

  const nextVersion = (latest?.version ?? 0) + 1;

  // Deactivate all current versions for this agent
  await db
    .update(promptVersions)
    .set({ isActive: false })
    .where(
      and(
        eq(promptVersions.agentSlug, agentSlug),
        eq(promptVersions.isActive, true),
      )
    );

  // Insert new active version
  const [newVersion] = await db
    .insert(promptVersions)
    .values({
      agentSlug,
      version: nextVersion,
      template,
      isActive: true,
      changeNote: changeNote || null,
      createdBy: user.id,
    })
    .returning({ id: promptVersions.id, version: promptVersions.version });

  // Auto-trigger eval with the new prompt
  await autoTriggerEval(portco.id, portcoSlug, agentSlug, newVersion.id, `v${newVersion.version}`, user.id);

  revalidatePath(`/${portcoSlug}/agents`, "layout");
  return newVersion;
}

/** Activate a specific prompt version */
export async function activatePromptVersion(
  portcoSlug: string,
  agentSlug: string,
  versionId: string,
) {
  const { portco, user } = await requireAdmin(portcoSlug);

  // Deactivate all
  await db
    .update(promptVersions)
    .set({ isActive: false })
    .where(
      and(
        eq(promptVersions.agentSlug, agentSlug),
        eq(promptVersions.isActive, true),
      )
    );

  // Activate the chosen one
  await db
    .update(promptVersions)
    .set({ isActive: true })
    .where(eq(promptVersions.id, versionId));

  // Get version info for eval label
  const [activated] = await db
    .select({ id: promptVersions.id, version: promptVersions.version })
    .from(promptVersions)
    .where(eq(promptVersions.id, versionId))
    .limit(1);

  // Auto-trigger eval with the activated prompt
  await autoTriggerEval(
    portco.id,
    portcoSlug,
    agentSlug,
    activated?.id ?? null,
    activated ? `v${activated.version}` : "Unknown",
    user.id,
  );

  revalidatePath(`/${portcoSlug}/agents`, "layout");
}

/** Reset to the default (code-defined) prompt by deactivating all versions */
export async function resetToDefaultPrompt(
  portcoSlug: string,
  agentSlug: string,
) {
  const { portco, user } = await requireAdmin(portcoSlug);

  await db
    .update(promptVersions)
    .set({ isActive: false })
    .where(
      and(
        eq(promptVersions.agentSlug, agentSlug),
        eq(promptVersions.isActive, true),
      )
    );

  // Auto-trigger eval with the default prompt
  await autoTriggerEval(portco.id, portcoSlug, agentSlug, null, "Default", user.id);

  revalidatePath(`/${portcoSlug}/agents`, "layout");
}
