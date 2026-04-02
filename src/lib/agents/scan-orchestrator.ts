import { db } from "@/lib/db";
import { files, deals } from "@/lib/db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk";
import { crawlAndSyncFiles, crawlFoldersIncremental } from "@/lib/gdrive/scanner";
import { gdriveFileCache } from "@/lib/db/schema";
import { classifyFile } from "./file-classifier";
import { processDDDocument } from "./dd-processor";
import type { FileType } from "@/lib/db/schema/files";

const IM_CONFIDENCE_THRESHOLD = 0.7;
const DD_TYPES = new Set<FileType>([
  "dd_financial", "dd_legal", "dd_operational", "dd_tax", "dd_hr", "dd_it",
]);

const PROCESSABLE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export interface ScanClassifyResult {
  totalFiles: number;
  newFiles: number;
  classified: number;
  imsRouted: number;
  ddRouted: number;
  excelRouted: number;
  skipped: number;
  failed: number;
  results: Array<{
    fileName: string;
    gdriveFileId: string;
    parentPath: string;
    fileType: FileType | null;
    confidence: number | null;
    status: "classified" | "im_routed" | "dd_routed" | "excel_routed" | "skipped" | "failed";
    dealId?: string | null;
    error?: string;
  }>;
}

/**
 * Try to match a file to an existing deal by company name.
 * Uses the folder path or classifier's suggested company name.
 */
async function matchDeal(
  portcoId: string,
  suggestedCompanyName: string | null,
  parentPath: string,
): Promise<string | null> {
  // Extract possible company name from folder path (first meaningful segment)
  const pathSegments = parentPath.split("/").filter(Boolean);
  const candidates = [
    suggestedCompanyName,
    ...pathSegments,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return null;

  // Try fuzzy matching each candidate against existing deals
  for (const candidate of candidates) {
    const [match] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(
        and(
          eq(deals.portcoId, portcoId),
          sql`LOWER(${deals.companyName}) = LOWER(${candidate})`,
        ),
      )
      .limit(1);

    if (match) return match.id;
  }

  return null;
}

/**
 * Scan GDrive recursively, classify each new file, and route to the appropriate processor.
 *
 * Flow:
 * 1. Recursive folder scan
 * 2. Dedup against existing files table
 * 3. Classify new PDFs via LLM
 * 4. Route: IMs → IM processor, DD docs → DD processor, others → store only
 */
export async function scanClassifyAndProcess(
  portcoId: string,
): Promise<ScanClassifyResult> {
  // 1. Recursively list all files, syncing to DB cache incrementally
  const { files: allGdriveFiles } = await crawlAndSyncFiles(portcoId);

  if (allGdriveFiles.length === 0) {
    return {
      totalFiles: 0, newFiles: 0, classified: 0,
      imsRouted: 0, ddRouted: 0, excelRouted: 0, skipped: 0, failed: 0, results: [],
    };
  }

  // 2. Filter to processable file types (PDFs + Excel)
  const pdfs = allGdriveFiles.filter(
    (f) => PROCESSABLE_MIME_TYPES.has(f.mimeType),
  );

  // 3. Dedup against already-imported files
  const gdriveIds = pdfs.map((f) => f.id);
  const existingFiles = gdriveIds.length > 0
    ? await db
        .select({
          gdriveFileId: files.gdriveFileId,
          processingStatus: files.processingStatus,
        })
        .from(files)
        .where(inArray(files.gdriveFileId, gdriveIds))
    : [];

  const existingSet = new Set(
    existingFiles.map((f) => f.gdriveFileId),
  );

  const newPdfs = pdfs.filter((f) => !existingSet.has(f.id));

  if (newPdfs.length === 0) {
    return {
      totalFiles: allGdriveFiles.length,
      newFiles: 0,
      classified: 0,
      imsRouted: 0,
      ddRouted: 0,
      excelRouted: 0,
      skipped: pdfs.length,
      failed: 0,
      results: pdfs.map((f) => ({
        fileName: f.name,
        gdriveFileId: f.id,
        parentPath: f.parentPath,
        fileType: null,
        confidence: null,
        status: "skipped" as const,
      })),
    };
  }

  // 4. Classify and route each new file
  const results: ScanClassifyResult["results"] = [];
  let classified = 0;
  let imsRouted = 0;
  let ddRouted = 0;
  let excelRouted = 0;
  let failed = 0;

  for (const pdf of newPdfs) {
    try {
      // Classify (pass portcoId + gdriveFileId for vision tier)
      const classification = await classifyFile({
        fileName: pdf.name,
        mimeType: pdf.mimeType,
        parentPath: pdf.parentPath,
        portcoId,
        gdriveFileId: pdf.id,
      });
      classified++;

      const fileType = classification.fileType;
      const confidence = classification.confidence;

      // Try to match to existing deal
      const dealId = await matchDeal(
        portcoId,
        classification.suggestedCompanyName,
        pdf.parentPath,
      );

      // Store file record
      const [fileRecord] = await db
        .insert(files)
        .values({
          dealId,
          portcoId,
          fileName: pdf.name,
          fileType,
          mimeType: pdf.mimeType,
          gdriveFileId: pdf.id,
          gdriveParentPath: pdf.parentPath || null,
          gdriveUrl: pdf.webViewLink,
          sizeBytes: pdf.size ? Number(pdf.size) : null,
          classifiedBy: "auto",
          classificationTier: classification.tier,
          classificationConfidence: confidence.toFixed(2),
          suggestedCompanyName: classification.suggestedCompanyName,
          processingStatus: "pending",
        })
        .returning({ id: files.id });

      // Route based on classification
      if (fileType === "im_pdf" && confidence >= IM_CONFIDENCE_THRESHOLD) {
        // Route to IM processor — trigger async processing task
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Trigger.dev SDK typing requires task type references
          await (tasks as any).trigger("process-im", {
            fileId: fileRecord.id,
            dealId,
            portcoId,
          });
          imsRouted++;
          results.push({
            fileName: pdf.name,
            gdriveFileId: pdf.id,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "im_routed",
            dealId,
          });
        } catch (e) {
          failed++;
          results.push({
            fileName: pdf.name,
            gdriveFileId: pdf.id,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "failed",
            dealId,
            error: e instanceof Error ? e.message : "IM trigger failed",
          });
        }
      } else if (DD_TYPES.has(fileType) && dealId) {
        // Route to DD processor if we have a deal to enrich
        try {
          await processDDDocument({
            fileId: fileRecord.id,
            dealId,
            portcoId,
            fileType,
          });
          ddRouted++;
          results.push({
            fileName: pdf.name,
            gdriveFileId: pdf.id,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "dd_routed",
            dealId,
          });
        } catch (e) {
          failed++;
          results.push({
            fileName: pdf.name,
            gdriveFileId: pdf.id,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "failed",
            dealId,
            error: e instanceof Error ? e.message : "DD processing failed",
          });
        }
      } else if (fileType === "excel_data") {
        // Route to Excel translator
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Trigger.dev SDK typing requires task type references
          await (tasks as any).trigger("translate-excel", {
            fileId: fileRecord.id,
            portcoId,
            gdriveFileId: pdf.id,
          });
          excelRouted++;
          results.push({
            fileName: pdf.name,
            gdriveFileId: pdf.id,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "excel_routed",
            dealId,
          });
        } catch (e) {
          failed++;
          results.push({
            fileName: pdf.name,
            gdriveFileId: pdf.id,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "failed",
            dealId,
            error: e instanceof Error ? e.message : "Excel translate trigger failed",
          });
        }
      } else {
        // Stored but not processed (other type, low confidence, or no deal match)
        results.push({
          fileName: pdf.name,
          gdriveFileId: pdf.id,
          parentPath: pdf.parentPath,
          fileType,
          confidence,
          status: "classified",
          dealId,
        });
      }
    } catch (error) {
      failed++;
      results.push({
        fileName: pdf.name,
        gdriveFileId: pdf.id,
        parentPath: pdf.parentPath,
        fileType: null,
        confidence: null,
        status: "failed",
        error: error instanceof Error ? error.message : "Classification failed",
      });
    }
  }

  return {
    totalFiles: allGdriveFiles.length,
    newFiles: newPdfs.length,
    classified,
    imsRouted,
    ddRouted,
    excelRouted,
    skipped: pdfs.length - newPdfs.length,
    failed,
    results,
  };
}

/** Time budget split: 60% crawl, 40% classify */
const CRAWL_BUDGET_RATIO = 0.6;

/**
 * Incremental version of scanClassifyAndProcess that works within a time budget.
 *
 * Instead of crawling the entire GDrive tree in one pass, this uses
 * `crawlFoldersIncremental()` to scan folders one at a time with DB-backed
 * checkpointing. New PDFs discovered in the cache are then classified and routed.
 *
 * Safe to call repeatedly — each invocation picks up where the last one left off.
 */
export async function scanClassifyAndProcessIncremental(
  portcoId: string,
  timeBudgetMs: number,
): Promise<ScanClassifyResult & { scanComplete: boolean; foldersErrored: number }> {
  const startTime = Date.now();

  // 1. Crawl folders incrementally (with ~60% of the time budget)
  const crawlBudget = Math.floor(timeBudgetMs * CRAWL_BUDGET_RATIO);
  const scanResult = await crawlFoldersIncremental(portcoId, crawlBudget);

  // 2. Query processable files from the cache that aren't yet in the files table.
  //    This is DB-driven rather than in-memory, so it works across multiple runs.
  const cachedPdfs = await db
    .select({
      gdriveFileId: gdriveFileCache.gdriveFileId,
      fileName: gdriveFileCache.fileName,
      mimeType: gdriveFileCache.mimeType,
      sizeBytes: gdriveFileCache.sizeBytes,
      webViewLink: gdriveFileCache.webViewLink,
      parentPath: gdriveFileCache.parentPath,
    })
    .from(gdriveFileCache)
    .where(
      and(
        eq(gdriveFileCache.portcoId, portcoId),
        inArray(gdriveFileCache.mimeType, [...PROCESSABLE_MIME_TYPES]),
      ),
    );

  if (cachedPdfs.length === 0) {
    return {
      totalFiles: scanResult.filesUpserted,
      newFiles: 0,
      classified: 0,
      imsRouted: 0,
      ddRouted: 0,
      excelRouted: 0,
      skipped: 0,
      failed: 0,
      results: [],
      scanComplete: scanResult.scanComplete,
      foldersErrored: scanResult.foldersErrored,
    };
  }

  // 3. Dedup against already-imported files
  const cacheGdriveIds = cachedPdfs.map((f) => f.gdriveFileId);
  const existingFiles = await db
    .select({ gdriveFileId: files.gdriveFileId })
    .from(files)
    .where(inArray(files.gdriveFileId, cacheGdriveIds));

  const existingSet = new Set(existingFiles.map((f) => f.gdriveFileId));
  const newPdfs = cachedPdfs.filter((f) => !existingSet.has(f.gdriveFileId));

  if (newPdfs.length === 0) {
    return {
      totalFiles: cachedPdfs.length,
      newFiles: 0,
      classified: 0,
      imsRouted: 0,
      ddRouted: 0,
      excelRouted: 0,
      skipped: cachedPdfs.length,
      failed: 0,
      results: [],
      scanComplete: scanResult.scanComplete,
      foldersErrored: scanResult.foldersErrored,
    };
  }

  // 4. Classify and route new files (with time budget check)
  const results: ScanClassifyResult["results"] = [];
  let classified = 0;
  let imsRouted = 0;
  let ddRouted = 0;
  let excelRouted = 0;
  let failed = 0;

  for (const pdf of newPdfs) {
    // Check if we're running low on time
    if (Date.now() - startTime >= timeBudgetMs) break;

    try {
      const classification = await classifyFile({
        fileName: pdf.fileName,
        mimeType: pdf.mimeType,
        parentPath: pdf.parentPath,
        portcoId,
        gdriveFileId: pdf.gdriveFileId,
      });
      classified++;

      const fileType = classification.fileType;
      const confidence = classification.confidence;

      const dealId = await matchDeal(
        portcoId,
        classification.suggestedCompanyName,
        pdf.parentPath,
      );

      const [fileRecord] = await db
        .insert(files)
        .values({
          dealId,
          portcoId,
          fileName: pdf.fileName,
          fileType,
          mimeType: pdf.mimeType,
          gdriveFileId: pdf.gdriveFileId,
          gdriveParentPath: pdf.parentPath || null,
          gdriveUrl: pdf.webViewLink,
          sizeBytes: pdf.sizeBytes ? Number(pdf.sizeBytes) : null,
          classifiedBy: "auto",
          classificationTier: classification.tier,
          classificationConfidence: confidence.toFixed(2),
          suggestedCompanyName: classification.suggestedCompanyName,
          processingStatus: "pending",
        })
        .returning({ id: files.id });

      if (fileType === "im_pdf" && confidence >= IM_CONFIDENCE_THRESHOLD) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Trigger.dev SDK typing requires task type references
          await (tasks as any).trigger("process-im", {
            fileId: fileRecord.id,
            dealId,
            portcoId,
          });
          imsRouted++;
          results.push({
            fileName: pdf.fileName,
            gdriveFileId: pdf.gdriveFileId,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "im_routed",
            dealId,
          });
        } catch (e) {
          failed++;
          results.push({
            fileName: pdf.fileName,
            gdriveFileId: pdf.gdriveFileId,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "failed",
            dealId,
            error: e instanceof Error ? e.message : "IM trigger failed",
          });
        }
      } else if (DD_TYPES.has(fileType) && dealId) {
        try {
          await processDDDocument({
            fileId: fileRecord.id,
            dealId,
            portcoId,
            fileType,
          });
          ddRouted++;
          results.push({
            fileName: pdf.fileName,
            gdriveFileId: pdf.gdriveFileId,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "dd_routed",
            dealId,
          });
        } catch (e) {
          failed++;
          results.push({
            fileName: pdf.fileName,
            gdriveFileId: pdf.gdriveFileId,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "failed",
            dealId,
            error: e instanceof Error ? e.message : "DD processing failed",
          });
        }
      } else if (fileType === "excel_data") {
        // Route to Excel translator
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Trigger.dev SDK typing requires task type references
          await (tasks as any).trigger("translate-excel", {
            fileId: fileRecord.id,
            portcoId,
            gdriveFileId: pdf.gdriveFileId,
          });
          excelRouted++;
          results.push({
            fileName: pdf.fileName,
            gdriveFileId: pdf.gdriveFileId,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "excel_routed",
            dealId,
          });
        } catch (e) {
          failed++;
          results.push({
            fileName: pdf.fileName,
            gdriveFileId: pdf.gdriveFileId,
            parentPath: pdf.parentPath,
            fileType,
            confidence,
            status: "failed",
            dealId,
            error: e instanceof Error ? e.message : "Excel translate trigger failed",
          });
        }
      } else {
        results.push({
          fileName: pdf.fileName,
          gdriveFileId: pdf.gdriveFileId,
          parentPath: pdf.parentPath,
          fileType,
          confidence,
          status: "classified",
          dealId,
        });
      }
    } catch (error) {
      failed++;
      results.push({
        fileName: pdf.fileName,
        gdriveFileId: pdf.gdriveFileId,
        parentPath: pdf.parentPath,
        fileType: null,
        confidence: null,
        status: "failed",
        error: error instanceof Error ? error.message : "Classification failed",
      });
    }
  }

  return {
    totalFiles: cachedPdfs.length,
    newFiles: newPdfs.length,
    classified,
    imsRouted,
    ddRouted,
    excelRouted,
    skipped: cachedPdfs.length - newPdfs.length,
    failed,
    results,
    scanComplete: scanResult.scanComplete,
    foldersErrored: scanResult.foldersErrored,
  };
}
