import { db } from "@/lib/db";
import { files, deals } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { downloadFile, listFiles } from "@/lib/gdrive/client";
import { analyzeIM, computeScoresFromAnalysis } from "./consensus";
import { filterRedFlags } from "./red-flag-detection";
import { storeResults, getDefaultStageId, createDealFromAnalysis, parseNumericValue } from "./storage";

interface ProcessIMInput {
  fileId: string; // files table ID
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
    companyName?: string;
    overallScore?: number;
    error?: string;
  }>;
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
  companyName?: string;
  overallScore?: number;
  redFlagCount?: number;
  error?: string;
}

export const CONCURRENCY_LIMIT = 3;

/** Run promises with a concurrency limit */
export async function pMap<T, R>(
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

/**
 * Scan the GDrive folder for PDFs, create deals for new ones,
 * and process them with AI. Runs up to CONCURRENCY_LIMIT in parallel.
 */
export async function scanAndProcessFolder(portcoId: string): Promise<ScanFolderResult> {
  // 1. List all files from GDrive
  const gdriveResult = await listFiles(portcoId, 200);
  if (!gdriveResult) {
    return { totalFiles: 0, newFiles: 0, processed: 0, failed: 0, skipped: 0, results: [] };
  }

  // 2. Filter to PDFs only
  const pdfs = gdriveResult.files.filter(
    (f) => f.mimeType === "application/pdf" && f.id
  );

  // 3. Find which GDrive file IDs are already imported
  const gdriveIds = pdfs.map((f) => f.id!);
  const existingFiles = gdriveIds.length > 0
    ? await db
        .select({ gdriveFileId: files.gdriveFileId, processingStatus: files.processingStatus })
        .from(files)
        .where(inArray(files.gdriveFileId, gdriveIds))
    : [];

  const existingMap = new Map(
    existingFiles.map((f) => [f.gdriveFileId, f.processingStatus])
  );

  // 4. Filter to unprocessed files (not imported, or imported but failed/pending)
  const toProcess = pdfs.filter((f) => {
    const status = existingMap.get(f.id!);
    if (status === undefined) return true; // new file
    if (status === "completed") return false; // already done
    return true; // retry failed/pending
  });

  if (toProcess.length === 0) {
    return {
      totalFiles: pdfs.length,
      newFiles: 0,
      processed: 0,
      failed: 0,
      skipped: pdfs.length,
      results: pdfs.map((f) => ({
        fileName: f.name ?? "Unknown",
        gdriveFileId: f.id!,
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
      const fileName = gdriveFile.name ?? "Unknown";
      const gdriveFileId = gdriveFile.id!;

      try {
        // Download PDF
        const buffer = await downloadFile(portcoId, gdriveFileId);
        if (!buffer) {
          return { fileName, gdriveFileId, status: "failed" as const, error: "Download failed" };
        }

        // Analyze with AI (PDF sent directly as multimodal input)
        const analysis = await analyzeIM(buffer);

        // Create deal if this is a new file
        const isNew = !existingMap.has(gdriveFileId);
        let dealId: string;

        if (isNew) {
          dealId = await createDealFromAnalysis(portcoId, stageId, analysis, gdriveFileId, gdriveFile.modifiedTime);

          // Create file record linked to the new deal
          await db.insert(files).values({
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
          });
        } else {
          // Find existing file+deal and update
          const [existingFile] = await db
            .select({ id: files.id, dealId: files.dealId })
            .from(files)
            .where(eq(files.gdriveFileId, gdriveFileId))
            .limit(1);

          dealId = existingFile.dealId;

          // Update deal fields from new analysis
          const fin = analysis.financialHighlights;
          await db
            .update(deals)
            .set({
              companyName: analysis.companyProfile.companyName,
              description: analysis.companyProfile.summary.slice(0, 500),
              location: analysis.companyProfile.location ?? null,
              industry: analysis.companyProfile.industry ?? null,
              askingPrice: parseNumericValue(analysis.companyProfile.askingPrice),
              revenue: parseNumericValue(fin.revenue),
              ebitda: parseNumericValue(fin.ebitda),
              currency: fin.currency ?? "JPY",
              employeeCount: fin.employeeCount ?? null,
              metadata: {
                gdriveSourceFileId: gdriveFileId,
                currency: fin.currency ?? null,
                askingPriceRaw: analysis.companyProfile.askingPrice ?? null,
                revenueRaw: fin.revenue ?? null,
                ebitdaRaw: fin.ebitda ?? null,
              },
              updatedAt: new Date(),
            })
            .where(eq(deals.id, dealId));

          await db
            .update(files)
            .set({ processingStatus: "completed", processedAt: new Date(), updatedAt: new Date() })
            .where(eq(files.id, existingFile.id));
        }

        // Store analysis results
        await storeResults(dealId, portcoId, analysis);

        const { weighted } = computeScoresFromAnalysis(analysis);

        return {
          fileName,
          gdriveFileId,
          status: "processed" as const,
          dealId,
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

/**
 * Reprocess all previously completed IM files for a portco.
 * Re-downloads PDFs, re-runs AI analysis, and overwrites profiles + red flags.
 * Useful when the scoring rubric or red flag definitions change.
 */
export async function reprocessAllFiles(portcoId: string): Promise<ReprocessResult> {
  // Find all completed PDF files for this portco
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

  // Reset all to processing
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
      if (!file.gdriveFileId) {
        return {
          fileId: file.id,
          fileName: file.fileName,
          dealId: file.dealId,
          status: "failed" as const,
          error: "No GDrive file ID",
        };
      }

      try {
        const buffer = await downloadFile(portcoId, file.gdriveFileId);
        if (!buffer) throw new Error("Download failed");

        // Analyze with AI (PDF sent directly as multimodal input)
        const analysis = await analyzeIM(buffer);
        await storeResults(file.dealId, portcoId, analysis);

        // Update deal fields from new analysis
        const fin = analysis.financialHighlights;
        await db
          .update(deals)
          .set({
            companyName: analysis.companyProfile.companyName,
            description: analysis.companyProfile.summary.slice(0, 500),
            location: analysis.companyProfile.location ?? null,
            industry: analysis.companyProfile.industry ?? null,
            askingPrice: parseNumericValue(analysis.companyProfile.askingPrice),
            revenue: parseNumericValue(fin.revenue),
            ebitda: parseNumericValue(fin.ebitda),
            currency: fin.currency ?? "JPY",
            employeeCount: fin.employeeCount ?? null,
            metadata: {
              gdriveSourceFileId: file.gdriveFileId,
              currency: fin.currency ?? null,
              askingPriceRaw: analysis.companyProfile.askingPrice ?? null,
              revenueRaw: fin.revenue ?? null,
              ebitdaRaw: fin.ebitda ?? null,
            },
            updatedAt: new Date(),
          })
          .where(eq(deals.id, file.dealId));

        await db
          .update(files)
          .set({ processingStatus: "completed", processedAt: new Date(), updatedAt: new Date() })
          .where(eq(files.id, file.id));

        const { weighted } = computeScoresFromAnalysis(analysis);

        return {
          fileId: file.id,
          fileName: file.fileName,
          dealId: file.dealId,
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
          dealId: file.dealId,
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

/**
 * Process a single GDrive file: download, extract, analyze, create deal + file record, store results.
 * This is the single-file equivalent of scanAndProcessFolder.
 * Optional onProgress callback for reporting step-by-step progress.
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
      return { success: true, dealId: existingFile.dealId, companyName: "(already processed)" };
    }

    // Download PDF
    progress("Downloading PDF from Google Drive...");
    const buffer = await downloadFile(portcoId, gdriveFileId);
    if (!buffer) return { success: false, error: "Failed to download from GDrive" };

    // Analyze with AI (PDF sent directly as multimodal input — handles scanned PDFs too)
    progress(`Analyzing IM with AI (${(buffer.length / 1024 / 1024).toFixed(1)} MB PDF)...`);
    const analysis = await analyzeIM(buffer);

    let dealId: string;
    let fileId: string;

    if (existingFile) {
      // Reuse existing file + deal, update deal fields from new analysis
      progress("Updating existing deal and file record...");
      dealId = existingFile.dealId;
      fileId = existingFile.id;

      const fin = analysis.financialHighlights;
      await db
        .update(deals)
        .set({
          companyName: analysis.companyProfile.companyName,
          description: analysis.companyProfile.summary.slice(0, 500),
          location: analysis.companyProfile.location ?? null,
          industry: analysis.companyProfile.industry ?? null,
          askingPrice: parseNumericValue(analysis.companyProfile.askingPrice),
          revenue: parseNumericValue(fin.revenue),
          ebitda: parseNumericValue(fin.ebitda),
          employeeCount: fin.employeeCount ?? null,
          metadata: {
            gdriveSourceFileId: gdriveFileId,
            currency: fin.currency ?? null,
            askingPriceRaw: analysis.companyProfile.askingPrice ?? null,
            revenueRaw: fin.revenue ?? null,
            ebitdaRaw: fin.ebitda ?? null,
          },
          updatedAt: new Date(),
        })
        .where(eq(deals.id, dealId));

      await db
        .update(files)
        .set({ processingStatus: "processing", updatedAt: new Date() })
        .where(eq(files.id, fileId));
    } else {
      // Create new deal
      progress(`Creating deal for "${analysis.companyProfile.companyName}"...`);
      const stageId = await getDefaultStageId(portcoId);
      dealId = await createDealFromAnalysis(portcoId, stageId, analysis, gdriveFileId, input.gdriveModifiedTime);

      // Create file record
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

    // Store results
    progress("Storing scoring results and red flags...");
    await storeResults(dealId, portcoId, analysis);

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
    // 1. Get the file record
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

    // 2. Mark as processing
    await db
      .update(files)
      .set({ processingStatus: "processing", updatedAt: new Date() })
      .where(eq(files.id, fileId));

    // 3. Download PDF
    const buffer = await downloadFile(portcoId, file.gdriveFileId);
    if (!buffer) {
      await db
        .update(files)
        .set({ processingStatus: "failed", updatedAt: new Date() })
        .where(eq(files.id, fileId));
      return { success: false, error: "Failed to download file from Google Drive" };
    }

    // 4. Analyze with AI (PDF sent directly as multimodal input)
    const analysis = await analyzeIM(buffer);

    // 5. Store results
    const profileId = await storeResults(dealId, portcoId, analysis);

    // 6. Mark file as completed
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

    // Mark file as failed
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
