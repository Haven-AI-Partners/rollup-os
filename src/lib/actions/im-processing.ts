"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { files, deals } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk";
import type { processIMTask, scanFolderTask, reprocessAllTask, processGdriveFileTask } from "@/trigger/im-processing";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";

async function requireAdmin(portcoId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const role = await getUserPortcoRole(user.id, portcoId);
  if (!role || !hasMinRole(role as UserRole, "admin")) {
    throw new Error("Admin access required");
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

  // Trigger background job
  const handle = await tasks.trigger<typeof processIMTask>("process-im", {
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
      await tasks.trigger<typeof processIMTask>("process-im", {
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
    await tasks.trigger<typeof processIMTask>("process-im", {
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

  const handle = await tasks.trigger<typeof scanFolderTask>("scan-gdrive-folder", {
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

  const handle = await tasks.trigger<typeof reprocessAllTask>("reprocess-all-ims", {
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

  const handle = await tasks.trigger<typeof processGdriveFileTask>("process-gdrive-file", {
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
