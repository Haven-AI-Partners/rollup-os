import { db } from "@/lib/db";
import { files, deals } from "@/lib/db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";
import { listFilesRecursive, type GDriveFileWithPath } from "@/lib/gdrive/scanner";
import { classifyFile } from "./file-classifier";
import { processDDDocument } from "./dd-processor";
import {
  scanAndProcessFolder as legacyScanIM,
} from "./im-processor";
import { downloadFile } from "@/lib/gdrive/client";
import type { FileType } from "@/lib/db/schema/files";

const IM_CONFIDENCE_THRESHOLD = 0.7;
const DD_TYPES = new Set<FileType>([
  "dd_financial", "dd_legal", "dd_operational", "dd_tax", "dd_hr", "dd_it",
]);

export interface ScanClassifyResult {
  totalFiles: number;
  newFiles: number;
  classified: number;
  imsRouted: number;
  ddRouted: number;
  skipped: number;
  failed: number;
  results: Array<{
    fileName: string;
    gdriveFileId: string;
    parentPath: string;
    fileType: FileType | null;
    confidence: number | null;
    status: "classified" | "im_routed" | "dd_routed" | "skipped" | "failed";
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
  // 1. Recursively list all files
  const allGdriveFiles = await listFilesRecursive(portcoId);

  if (allGdriveFiles.length === 0) {
    return {
      totalFiles: 0, newFiles: 0, classified: 0,
      imsRouted: 0, ddRouted: 0, skipped: 0, failed: 0, results: [],
    };
  }

  // 2. Filter to PDFs
  const pdfs = allGdriveFiles.filter(
    (f) => f.mimeType === "application/pdf",
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
    existingFiles
      .filter((f) => f.processingStatus === "completed")
      .map((f) => f.gdriveFileId),
  );

  const newPdfs = pdfs.filter((f) => !existingSet.has(f.id));

  if (newPdfs.length === 0) {
    return {
      totalFiles: allGdriveFiles.length,
      newFiles: 0,
      classified: 0,
      imsRouted: 0,
      ddRouted: 0,
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
  let failed = 0;

  for (const pdf of newPdfs) {
    try {
      // Classify
      const classification = await classifyFile({
        fileName: pdf.name,
        mimeType: pdf.mimeType,
        parentPath: pdf.parentPath,
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
          classificationConfidence: confidence.toFixed(2),
          processingStatus: "pending",
        })
        .returning({ id: files.id });

      // Route based on classification
      if (fileType === "im_pdf" && confidence >= IM_CONFIDENCE_THRESHOLD) {
        // Route to IM processor — it creates deals and does full analysis
        // For now, just mark as pending for the existing IM processing pipeline
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
    skipped: pdfs.length - newPdfs.length,
    failed,
    results,
  };
}
