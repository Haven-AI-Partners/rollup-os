import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { downloadFile } from "@/lib/gdrive/client";
import { listFilesRecursive } from "@/lib/gdrive/scanner";
import { runIMPipeline } from "./pipeline";
import {
  computeScoresFromAnalysis,
  filterRedFlags,
  storePipelineResults,
  getDefaultStageId,
  createDealFromPipelineResult,
  updateDealFromPipelineResult,
} from "./store-results";

// Re-export for external consumers
export { computeScoresFromAnalysis } from "./store-results";
export { MODEL_ID } from "./agents/analyzer";

interface ProcessIMInput {
  fileId: string;
  dealId: string;
  portcoId: string;
}

interface ProcessIMResult {
  success: boolean;
  profileId?: string;
  overallScore?: number;
  redFlagCount?: number;
  error?: string;
}

const CONCURRENCY_LIMIT = 3;

/** Run promises with a concurrency limit */
async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

interface ScanFolderResult {
  totalFiles: number;
  newFiles: number;
  processed: number;
  failed: number;
  skipped: number;
  results: Array<{
    fileName: string;
    gdriveFileId: string;
    status: "processed" | "failed" | "skipped";
    dealId?: string;
    isNewDeal?: boolean;
    companyName?: string;
    overallScore?: number;
    error?: string;
  }>;
}

/**
 * Scan the GDrive folder for PDFs, create deals for new ones,
 * and process them with the 4-agent pipeline. Runs up to CONCURRENCY_LIMIT in parallel.
 */
export async function scanAndProcessFolder(portcoId: string): Promise<ScanFolderResult> {
  // 1. Recursively list all files from GDrive
  const allFiles = await listFilesRecursive(portcoId);
  if (allFiles.length === 0) {
    return { totalFiles: 0, newFiles: 0, processed: 0, failed: 0, skipped: 0, results: [] };
  }

  // 2. Filter to PDFs only
  const pdfs = allFiles.filter(
    (f) => f.mimeType === "application/pdf" && f.id
  );

  // 3. Find which GDrive file IDs are already imported
  const gdriveIds = pdfs.map((f) => f.id);
  const existingFiles = gdriveIds.length > 0
    ? await db
        .select({ gdriveFileId: files.gdriveFileId, processingStatus: files.processingStatus })
        .from(files)
        .where(inArray(files.gdriveFileId, gdriveIds))
    : [];

  const existingMap = new Map(
    existingFiles.map((f) => [f.gdriveFileId, f.processingStatus])
  );

  // 4. Filter to unprocessed files
  const toProcess = pdfs.filter((f) => {
    const status = existingMap.get(f.id);
    if (status === undefined) return true;
    if (status === "completed") return false;
    return true;
  });

  if (toProcess.length === 0) {
    return {
      totalFiles: pdfs.length,
      newFiles: 0,
      processed: 0,
      failed: 0,
      skipped: pdfs.length,
      results: pdfs.map((f) => ({
        fileName: f.name,
        gdriveFileId: f.id,
        status: "skipped" as const,
      })),
    };
  }

  // 5. Get default stage for new deals
  const stageId = await getDefaultStageId(portcoId);

  // 6. Process files with concurrency limit
  const results = await pMap(
    toProcess,
    async (gdriveFile) => {
      const fileName = gdriveFile.name;
      const gdriveFileId = gdriveFile.id;

      try {
        const buffer = await downloadFile(portcoId, gdriveFileId);
        if (!buffer) {
          return { fileName, gdriveFileId, status: "failed" as const, error: "Download failed" };
        }

        // Run 4-agent pipeline
        const pipelineResult = await runIMPipeline(buffer);
        const analysis = pipelineResult.legacyAnalysis;

        const isNew = !existingMap.has(gdriveFileId);
        let dealId: string;
        let resolvedFileId: string | undefined;

        if (isNew) {
          dealId = await createDealFromPipelineResult(portcoId, stageId, pipelineResult, gdriveFileId, gdriveFile.modifiedTime);

          const [newFile] = await db.insert(files).values({
            dealId,
            portcoId,
            fileName,
            fileType: "im_pdf",
            mimeType: "application/pdf",
            gdriveFileId,
            gdriveUrl: gdriveFile.webViewLink ?? null,
            sizeBytes: gdriveFile.size ? Number(gdriveFile.size) : null,
            processingStatus: "completed",
            processedAt: new Date(),
          }).returning({ id: files.id });
          resolvedFileId = newFile.id;
        } else {
          const [existingFile] = await db
            .select({ id: files.id, dealId: files.dealId })
            .from(files)
            .where(eq(files.gdriveFileId, gdriveFileId))
            .limit(1);

          resolvedFileId = existingFile.id;

          if (existingFile.dealId) {
            dealId = existingFile.dealId;
            await updateDealFromPipelineResult(dealId, pipelineResult, gdriveFileId);
          } else {
            dealId = await createDealFromPipelineResult(portcoId, stageId, pipelineResult, gdriveFileId, gdriveFile.modifiedTime);
            await db
              .update(files)
              .set({ dealId, updatedAt: new Date() })
              .where(eq(files.id, existingFile.id));
          }

          await db
            .update(files)
            .set({ processingStatus: "completed", processedAt: new Date(), updatedAt: new Date() })
            .where(eq(files.id, existingFile.id));
        }

        await storePipelineResults(dealId, portcoId, pipelineResult, resolvedFileId);

        const { weighted } = computeScoresFromAnalysis(analysis);

        return {
          fileName,
          gdriveFileId,
          status: "processed" as const,
          dealId,
          isNewDeal: isNew,
          companyName: analysis.companyProfile.companyName,
          overallScore: weighted,
        };
      } catch (error) {
        console.error(`Failed to process ${fileName}:`, error);
        return {
          fileName,
          gdriveFileId,
          status: "failed" as const,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    CONCURRENCY_LIMIT
  );

  const processed = results.filter((r) => r.status === "processed").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return {
    totalFiles: pdfs.length,
    newFiles: toProcess.filter((f) => !existingMap.has(f.id!)).length,
    processed,
    failed,
    skipped: pdfs.length - toProcess.length,
    results,
  };
}

interface ReprocessResult {
  total: number;
  processed: number;
  failed: number;
  results: Array<{
    fileId: string;
    fileName: string;
    dealId: string;
    status: "processed" | "failed";
    overallScore?: number;
    error?: string;
  }>;
}

/**
 * Reprocess all previously completed IM files for a portco.
 * Re-downloads PDFs, re-runs 4-agent pipeline, and overwrites profiles + red flags.
 */
export async function reprocessAllFiles(portcoId: string): Promise<ReprocessResult> {
  const completedFiles = await db
    .select({
      id: files.id,
      fileName: files.fileName,
      dealId: files.dealId,
      gdriveFileId: files.gdriveFileId,
    })
    .from(files)
    .where(
      and(
        eq(files.portcoId, portcoId),
        eq(files.processingStatus, "completed"),
        eq(files.mimeType, "application/pdf"),
      )
    );

  if (completedFiles.length === 0) {
    return { total: 0, processed: 0, failed: 0, results: [] };
  }

  await db
    .update(files)
    .set({ processingStatus: "processing", updatedAt: new Date() })
    .where(
      inArray(
        files.id,
        completedFiles.map((f) => f.id)
      )
    );

  const results = await pMap(
    completedFiles,
    async (file) => {
      const fileDealId = file.dealId!;
      if (!file.gdriveFileId) {
        return {
          fileId: file.id,
          fileName: file.fileName,
          dealId: fileDealId,
          status: "failed" as const,
          error: "No GDrive file ID",
        };
      }

      try {
        const buffer = await downloadFile(portcoId, file.gdriveFileId);
        if (!buffer) throw new Error("Download failed");

        const pipelineResult = await runIMPipeline(buffer);
        await storePipelineResults(fileDealId, portcoId, pipelineResult, file.id);
        await updateDealFromPipelineResult(fileDealId, pipelineResult, file.gdriveFileId);

        await db
          .update(files)
          .set({ processingStatus: "completed", processedAt: new Date(), updatedAt: new Date() })
          .where(eq(files.id, file.id));

        const { weighted } = computeScoresFromAnalysis(pipelineResult.legacyAnalysis);

        return {
          fileId: file.id,
          fileName: file.fileName,
          dealId: fileDealId,
          status: "processed" as const,
          overallScore: weighted,
        };
      } catch (error) {
        await db
          .update(files)
          .set({ processingStatus: "failed", updatedAt: new Date() })
          .where(eq(files.id, file.id))
          .catch(() => {});

        return {
          fileId: file.id,
          fileName: file.fileName,
          dealId: fileDealId,
          status: "failed" as const,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    CONCURRENCY_LIMIT,
  );

  return {
    total: completedFiles.length,
    processed: results.filter((r) => r.status === "processed").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}

interface ProcessGdriveFileInput {
  portcoId: string;
  gdriveFileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  webViewLink: string | null;
  gdriveModifiedTime?: string | null;
  force?: boolean;
}

interface ProcessGdriveFileResult {
  success: boolean;
  dealId?: string;
  isNewDeal?: boolean;
  companyName?: string;
  overallScore?: number;
  redFlagCount?: number;
  error?: string;
}

/**
 * Process a single GDrive file through the 4-agent pipeline.
 * This is the single-file equivalent of scanAndProcessFolder.
 */
export async function processSingleGdriveFile(
  input: ProcessGdriveFileInput,
  onProgress?: (step: string) => void,
): Promise<ProcessGdriveFileResult> {
  const { portcoId, gdriveFileId, fileName, mimeType, sizeBytes, webViewLink } = input;
  const progress = onProgress ?? (() => {});

  try {
    // Check if already imported
    progress("Checking if file was already processed...");
    const [existingFile] = await db
      .select({ id: files.id, dealId: files.dealId, processingStatus: files.processingStatus })
      .from(files)
      .where(eq(files.gdriveFileId, gdriveFileId))
      .limit(1);

    if (existingFile?.processingStatus === "completed" && !input.force) {
      return { success: true, dealId: existingFile.dealId ?? undefined, companyName: "(already processed)" };
    }

    // Download PDF
    progress("Downloading PDF from Google Drive...");
    const buffer = await downloadFile(portcoId, gdriveFileId);
    if (!buffer) return { success: false, error: "Failed to download from GDrive" };

    // Run 4-agent pipeline (with progress forwarding)
    progress(`Running IM analysis pipeline (${(buffer.length / 1024 / 1024).toFixed(1)} MB PDF)...`);
    const pipelineResult = await runIMPipeline(buffer, progress);
    const analysis = pipelineResult.legacyAnalysis;

    let dealId: string;
    let fileId: string;

    if (existingFile && existingFile.dealId) {
      progress("Updating existing deal and file record...");
      dealId = existingFile.dealId;
      fileId = existingFile.id;
      await updateDealFromPipelineResult(dealId, pipelineResult, gdriveFileId);

      await db
        .update(files)
        .set({ processingStatus: "processing", updatedAt: new Date() })
        .where(eq(files.id, fileId));
    } else {
      progress(`Creating deal for "${analysis.companyProfile.companyName}"...`);
      const stageId = await getDefaultStageId(portcoId);
      dealId = await createDealFromPipelineResult(portcoId, stageId, pipelineResult, gdriveFileId, input.gdriveModifiedTime);

      if (existingFile) {
        fileId = existingFile.id;
        await db
          .update(files)
          .set({ dealId, processingStatus: "processing", updatedAt: new Date() })
          .where(eq(files.id, fileId));
      } else {
        const [newFile] = await db
          .insert(files)
          .values({
            dealId,
            portcoId,
            fileName,
            fileType: "im_pdf",
            mimeType,
            gdriveFileId,
            gdriveUrl: webViewLink,
            sizeBytes,
            processingStatus: "processing",
          })
          .returning({ id: files.id });
        fileId = newFile.id;
      }
    }

    // Store results
    progress("Storing analysis results...");
    await storePipelineResults(dealId, portcoId, pipelineResult, fileId);

    // Mark complete
    progress("Done!");
    await db
      .update(files)
      .set({ processingStatus: "completed", processedAt: new Date(), updatedAt: new Date() })
      .where(eq(files.id, fileId));

    const { weighted } = computeScoresFromAnalysis(analysis);

    return {
      success: true,
      dealId,
      isNewDeal: !existingFile?.dealId,
      companyName: analysis.companyProfile.companyName,
      overallScore: weighted,
      redFlagCount: filterRedFlags(analysis).confirmedFlags.length + filterRedFlags(analysis).confirmedGaps.length,
    };
  } catch (error) {
    console.error(`Failed to process ${fileName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/** Main entry point: process a single IM file end-to-end */
export async function processIM(input: ProcessIMInput): Promise<ProcessIMResult> {
  const { fileId, dealId, portcoId } = input;

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      return { success: false, error: "File not found" };
    }

    if (!file.gdriveFileId) {
      return { success: false, error: "File has no Google Drive ID" };
    }

    await db
      .update(files)
      .set({ processingStatus: "processing", updatedAt: new Date() })
      .where(eq(files.id, fileId));

    const buffer = await downloadFile(portcoId, file.gdriveFileId);
    if (!buffer) {
      await db
        .update(files)
        .set({ processingStatus: "failed", updatedAt: new Date() })
        .where(eq(files.id, fileId));
      return { success: false, error: "Failed to download file from Google Drive" };
    }

    // Run 4-agent pipeline
    const pipelineResult = await runIMPipeline(buffer);
    const analysis = pipelineResult.legacyAnalysis;

    const profileId = await storePipelineResults(dealId, portcoId, pipelineResult, fileId);

    await db
      .update(files)
      .set({
        processingStatus: "completed",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));

    const redFlagCount = filterRedFlags(analysis).confirmedFlags.length + filterRedFlags(analysis).confirmedGaps.length;
    const { weighted } = computeScoresFromAnalysis(analysis);

    return {
      success: true,
      profileId,
      overallScore: weighted,
      redFlagCount,
    };
  } catch (error) {
    console.error("IM processing error:", error);

    await db
      .update(files)
      .set({ processingStatus: "failed", updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .catch(() => {});

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
