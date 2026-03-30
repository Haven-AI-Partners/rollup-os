import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  getPortcoBySlug,
  getCurrentUser,
  getUserPortcoRole,
  hasMinRole,
  type UserRole,
} from "@/lib/auth";

/**
 * Resolve portco + user role for an agent page.
 * Always calls notFound() if portco doesn't exist.
 * Returns computed role flags so pages can decide their own access policy.
 */
export async function getAgentPageAuth(portcoSlug: string) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const user = await getCurrentUser();
  const role = user ? await getUserPortcoRole(user.id, portco.id) : null;

  return {
    portco,
    isAnalyst: role ? hasMinRole(role as UserRole, "analyst") : false,
    isAdmin: role ? hasMinRole(role as UserRole, "admin") : false,
  };
}

/**
 * Load prompt versions for an agent slug and prepare client-serializable data.
 * Optionally applies a render function to the active template.
 */
export async function getPromptVersionsForAgent(
  agentSlug: string,
  defaultTemplate: string,
  renderFn?: (template: string) => string,
) {
  const versions = await db
    .select({
      id: promptVersions.id,
      version: promptVersions.version,
      template: promptVersions.template,
      isActive: promptVersions.isActive,
      changeNote: promptVersions.changeNote,
      createdAt: promptVersions.createdAt,
    })
    .from(promptVersions)
    .where(eq(promptVersions.agentSlug, agentSlug))
    .orderBy(desc(promptVersions.version));

  const activeVersion = versions.find((v) => v.isActive);
  const currentTemplate = activeVersion?.template ?? defaultTemplate;
  const renderedPrompt = renderFn ? renderFn(currentTemplate) : currentTemplate;

  const versionsForClient = versions.map((v) => ({
    id: v.id,
    version: v.version,
    template: v.template,
    isActive: v.isActive,
    changeNote: v.changeNote,
    createdAt: v.createdAt.toISOString(),
  }));

  return { currentTemplate, renderedPrompt, versionsForClient };
}
