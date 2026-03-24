"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { files, deals, evalRuns, promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk";
import type { processIMTask, scanFolderTask, reprocessAllTask, processGdriveFileTask, runEvalTask } from "@/trigger/im-processing";
import { getPortcoBySlug, requireAuth, requirePortcoRole } from "@/lib/auth";

async function requireAdmin(portcoId: string) {
  await requirePortcoRole(portcoId, "admin");
}

async function triggerTask<T>(taskId: string, payload: object): Promise<{ id: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Trigger.dev SDK requires generic task type
    return await tasks.trigger<T>(taskId as any, payload as any);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to trigger background job "${taskId}": ${message}`);
  }
}

/**
 * Process an IM file as a background job via Trigger.dev.
 * Returns the triggered run handle immediately.
 */
export async function processIMFile(portcoSlug: string, fileId: string) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) throw new Error("PortCo not found");
  await requireAdmin(portco.id);

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.portcoId, portco.id)))
    .limit(1);

  if (!file) throw new Error("File not found");

  // Mark as processing immediately
  await db
    .update(files)
    .set({ processingStatus: "processing", updatedAt: new Date() })
    .where(eq(files.id, fileId));

  const handle = await triggerTask<typeof processIMTask>("process-im", {
    fileId: file.id,
    dealId: file.dealId,
    portcoId: portco.id,
  });

  revalidatePath(`/${portcoSlug}/pipeline/${file.dealId}`);
  return { triggered: true, runId: handle.id };
}

/**
 * Import a GDrive file into the files table and optionally trigger processing.
 * Used when selecting a file from the GDrive browser to associate with a deal.
 */
export async function importGdriveFile(
  portcoSlug: string,
  dealId: string,
  gdriveFileId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number | null,
  webViewLink: string | null,
  autoProcess: boolean = false,
) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) throw new Error("PortCo not found");
  await requireAdmin(portco.id);

  // Check deal exists and belongs to this portco
  const [deal] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.portcoId, portco.id)))
    .limit(1);
  if (!deal) throw new Error("Deal not found");

  // Check if file already imported
  const [existing] = await db
    .select()
    .from(files)
    .where(and(eq(files.gdriveFileId, gdriveFileId), eq(files.dealId, dealId)))
    .limit(1);

  if (existing) {
    if (autoProcess && existing.processingStatus !== "completed") {
      await triggerTask<typeof processIMTask>("process-im", {
        fileId: existing.id,
        dealId,
        portcoId: portco.id,
      });
      revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
      return { fileId: existing.id, triggered: true };
    }
    return { fileId: existing.id, success: true, alreadyExists: true };
  }

  // Determine file type from name
  const fileType = guessFileType(fileName);

  // Insert file record
  const [newFile] = await db
    .insert(files)
    .values({
      dealId,
      portcoId: portco.id,
      fileName,
      fileType,
      mimeType,
      gdriveFileId,
      gdriveUrl: webViewLink,
      sizeBytes,
      processingStatus: autoProcess ? "processing" : "pending",
    })
    .returning({ id: files.id });

  if (autoProcess && mimeType === "application/pdf") {
    await triggerTask<typeof processIMTask>("process-im", {
      fileId: newFile.id,
      dealId,
      portcoId: portco.id,
    });
    revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
    return { fileId: newFile.id, triggered: true };
  }

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
  return { fileId: newFile.id, success: true };
}

/**
 * Scan the GDrive folder for new PDF files, auto-create deals,
 * and process all IMs with AI. Runs as a background job via Trigger.dev.
 */
export async function scanGdriveFolder(portcoSlug: string) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) throw new Error("PortCo not found");
  await requireAdmin(portco.id);

  const handle = await triggerTask<typeof scanFolderTask>("scan-gdrive-folder", {
    portcoId: portco.id,
  });

  return { triggered: true, runId: handle.id };
}

/**
 * Reprocess all previously completed IM files.
 * Useful after scoring rubric or red flag definition changes.
 */
export async function reprocessAllIMFiles(portcoSlug: string) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) throw new Error("PortCo not found");
  await requireAdmin(portco.id);

  const handle = await triggerTask<typeof reprocessAllTask>("reprocess-all-ims", {
    portcoId: portco.id,
  });

  return { triggered: true, runId: handle.id };
}

/**
 * Process a single GDrive file: creates a deal, imports the file, and analyzes it.
 * Runs as a background job via Trigger.dev.
 */
export async function processSingleFile(
  portcoSlug: string,
  gdriveFileId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number | null,
  webViewLink: string | null,
  force?: boolean,
  gdriveModifiedTime?: string | null,
) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) throw new Error("PortCo not found");
  await requireAdmin(portco.id);

  const handle = await triggerTask<typeof processGdriveFileTask>("process-gdrive-file", {
    portcoId: portco.id,
    gdriveFileId,
    fileName,
    mimeType,
    sizeBytes,
    webViewLink,
    gdriveModifiedTime,
    force,
  });

  return { triggered: true, runId: handle.id };
}

/**
 * Run a consistency eval on a processed file.
 * Processes the same IM N times and compares results.
 */
export async function triggerEvalRun(
  portcoSlug: string,
  fileId: string,
  iterations: number = 3,
) {
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) throw new Error("PortCo not found");
  await requireAdmin(portco.id);

  const user = await requireAuth();

  // Get the file
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.portcoId, portco.id)))
    .limit(1);
  if (!file) throw new Error("File not found");

  // Get active prompt version info
  const [activePrompt] = await db
    .select({ id: promptVersions.id, version: promptVersions.version })
    .from(promptVersions)
    .where(and(eq(promptVersions.agentSlug, "im-processor"), eq(promptVersions.isActive, true)))
    .orderBy(desc(promptVersions.version))
    .limit(1);

  // Import MODEL_ID dynamically to avoid circular deps
  const { MODEL_ID } = await import("@/lib/agents/im-processor");

  // Create eval run record
  const [evalRun] = await db
    .insert(evalRuns)
    .values({
      agentSlug: "im-processor",
      fileId,
      fileName: file.fileName,
      iterations,
      status: "running",
      promptVersionId: activePrompt?.id ?? null,
      promptVersionLabel: activePrompt ? `v${activePrompt.version}` : "Default",
      modelId: MODEL_ID,
      createdBy: user?.id ?? null,
    })
    .returning({ id: evalRuns.id });

  const handle = await triggerTask<typeof runEvalTask>("run-im-eval", {
    evalRunId: evalRun.id,
    fileId,
    portcoId: portco.id,
    iterations,
  });

  revalidatePath(`/${portcoSlug}/agents`);
  return { triggered: true, runId: handle.id, evalRunId: evalRun.id };
}

function guessFileType(fileName: string): "im_pdf" | "other" {
  const lower = fileName.toLowerCase();
  if (
    lower.includes("im") ||
    lower.includes("information memorandum") ||
    lower.includes("企業概要") ||
    lower.includes("案件概要")
  ) {
    return "im_pdf";
  }
  return "other";
}
