"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

/** Save a new prompt version and set it as active */
export async function savePromptVersion(
  portcoSlug: string,
  agentSlug: string,
  template: string,
  changeNote?: string,
) {
  const { user } = await requireAdmin(portcoSlug);

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

  revalidatePath(`/${portcoSlug}/agents`);
  return newVersion;
}

/** Activate a specific prompt version */
export async function activatePromptVersion(
  portcoSlug: string,
  agentSlug: string,
  versionId: string,
) {
  await requireAdmin(portcoSlug);

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

  revalidatePath(`/${portcoSlug}/agents`);
}

/** Reset to the default (code-defined) prompt by deactivating all versions */
export async function resetToDefaultPrompt(
  portcoSlug: string,
  agentSlug: string,
) {
  await requireAdmin(portcoSlug);

  await db
    .update(promptVersions)
    .set({ isActive: false })
    .where(
      and(
        eq(promptVersions.agentSlug, agentSlug),
        eq(promptVersions.isActive, true),
      )
    );

  revalidatePath(`/${portcoSlug}/agents`);
}
