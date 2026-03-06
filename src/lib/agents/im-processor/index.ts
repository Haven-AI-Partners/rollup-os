import { streamObject } from "ai";
import { moonshotai } from "@ai-sdk/moonshotai";
import { db } from "@/lib/db";
import { companyProfiles, dealRedFlags, files, deals, pipelineStages } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { downloadFile, listFiles } from "@/lib/gdrive/client";
import { calculateWeightedScore } from "@/lib/scoring/rubric";
import { RED_FLAG_DEFINITIONS } from "@/lib/scoring/red-flags";
import { buildSystemPrompt } from "./prompt";
import { imAnalysisSchema, type IMAnalysisResult } from "./schema";

const MODEL_ID = "kimi-latest";
const MAX_TEXT_CHARS = 100_000; // ~25k tokens, keeps memory and cost manageable

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

/** Extract text from a PDF buffer, truncated to MAX_TEXT_CHARS */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Point workerSrc to the actual worker file so the fake worker can import it
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");

  const { dirname, join } = await import("node:path");
  const standardFontDataUrl = join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + "/";

  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, standardFontDataUrl, useSystemFonts: true }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parts.push(content.items.map((item: any) => item.str ?? "").join(" "));
  }
  await doc.destroy();
  const text = parts.join("\n");
  if (text.length > MAX_TEXT_CHARS) {
    return text.slice(0, MAX_TEXT_CHARS) + "\n\n[Text truncated due to length]";
  }
  return text;
}

/** Download a file from GDrive and extract text */
async function getFileText(portcoId: string, gdriveFileId: string): Promise<string> {
  const buffer = await downloadFile(portcoId, gdriveFileId);
  if (!buffer) {
    throw new Error("Failed to download file from Google Drive");
  }
  return extractPdfText(buffer);
}

/** Run the IM analysis with streaming to reduce memory usage */
async function analyzeIM(text: string): Promise<IMAnalysisResult> {
  const result = streamObject({
    model: moonshotai(MODEL_ID),
    schema: imAnalysisSchema,
    system: buildSystemPrompt(),
    prompt: `Analyze the following Information Memorandum:\n\n${text}`,
    temperature: 0.1,
  });

  return result.object;
}

/** Store analysis results in the database */
async function storeResults(
  dealId: string,
  portcoId: string,
  analysis: IMAnalysisResult
): Promise<string> {
  // Calculate weighted score
  const scores: Record<string, number> = {};
  for (const [dimId, dimResult] of Object.entries(analysis.scoring)) {
    scores[dimId] = dimResult.score;
  }
  const { weighted } = calculateWeightedScore(scores);

  // Build scoring breakdown with rationales
  const scoringBreakdown: Record<string, { score: number; rationale: string }> = {};
  for (const [dimId, dimResult] of Object.entries(analysis.scoring)) {
    scoringBreakdown[dimId] = {
      score: dimResult.score,
      rationale: dimResult.rationale,
    };
  }

  // Upsert company profile
  const [profile] = await db
    .insert(companyProfiles)
    .values({
      dealId,
      summary: analysis.companyProfile.summary,
      businessModel: analysis.companyProfile.businessModel,
      marketPosition: analysis.companyProfile.marketPosition,
      industryTrends: analysis.companyProfile.industryTrends,
      strengths: analysis.companyProfile.strengths,
      keyRisks: analysis.companyProfile.keyRisks,
      financialHighlights: analysis.financialHighlights,
      aiOverallScore: weighted.toString(),
      scoringBreakdown,
      rawExtraction: analysis,
      generatedAt: new Date(),
      modelVersion: MODEL_ID,
    })
    .onConflictDoUpdate({
      target: companyProfiles.dealId,
      set: {
        summary: analysis.companyProfile.summary,
        businessModel: analysis.companyProfile.businessModel,
        marketPosition: analysis.companyProfile.marketPosition,
        industryTrends: analysis.companyProfile.industryTrends,
        strengths: analysis.companyProfile.strengths,
        keyRisks: analysis.companyProfile.keyRisks,
        financialHighlights: analysis.financialHighlights,
        aiOverallScore: weighted.toString(),
        scoringBreakdown,
        rawExtraction: analysis,
        generatedAt: new Date(),
        modelVersion: MODEL_ID,
        updatedAt: new Date(),
      },
    })
    .returning({ id: companyProfiles.id });

  // Delete existing AI-generated red flags for this deal, then insert new ones
  await db
    .delete(dealRedFlags)
    .where(eq(dealRedFlags.dealId, dealId));

  // Combine red flags + info gaps
  const allFlags = [
    ...analysis.redFlags,
    ...analysis.infoGaps,
  ];

  if (allFlags.length > 0) {
    // Validate flag IDs against known definitions
    const knownIds = new Set(RED_FLAG_DEFINITIONS.map((f) => f.id));
    const validFlags = allFlags.filter((f) => knownIds.has(f.flagId));

    if (validFlags.length > 0) {
      await db.insert(dealRedFlags).values(
        validFlags.map((flag) => {
          const def = RED_FLAG_DEFINITIONS.find((d) => d.id === flag.flagId)!;
          return {
            dealId,
            portcoId,
            flagId: flag.flagId,
            severity: def.severity,
            category: def.category,
            notes: flag.notes,
          };
        })
      );
    }
  }

  return profile.id;
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

/** Get or create the first "sourcing" stage for a portco */
async function getDefaultStageId(portcoId: string): Promise<string> {
  const [stage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(and(eq(pipelineStages.portcoId, portcoId), eq(pipelineStages.phase, "sourcing")))
    .orderBy(pipelineStages.position)
    .limit(1);

  if (stage) return stage.id;

  // Fallback: get any first stage
  const [anyStage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(eq(pipelineStages.portcoId, portcoId))
    .orderBy(pipelineStages.position)
    .limit(1);

  if (anyStage) return anyStage.id;
  throw new Error("No pipeline stages found for this portco");
}

/** Create a deal from IM analysis results */
async function createDealFromAnalysis(
  portcoId: string,
  stageId: string,
  analysis: IMAnalysisResult,
  gdriveFileId: string,
): Promise<string> {
  const fin = analysis.financialHighlights;
  const [deal] = await db
    .insert(deals)
    .values({
      portcoId,
      stageId,
      companyName: analysis.companyProfile.companyName,
      description: analysis.companyProfile.summary.slice(0, 500),
      source: "agent_scraped" as const,
      location: analysis.companyProfile.location ?? null,
      industry: analysis.companyProfile.industry ?? null,
      askingPrice: analysis.companyProfile.askingPrice ?? null,
      employeeCount: fin.employeeCount ?? null,
      status: "active",
      kanbanPosition: 0,
      metadata: { gdriveSourceFileId: gdriveFileId },
    })
    .returning({ id: deals.id });

  return deal.id;
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
        // Download and extract text
        const buffer = await downloadFile(portcoId, gdriveFileId);
        if (!buffer) {
          return { fileName, gdriveFileId, status: "failed" as const, error: "Download failed" };
        }

        const text = await extractPdfText(buffer);
        if (!text.trim()) {
          return { fileName, gdriveFileId, status: "failed" as const, error: "No text extracted" };
        }

        // Analyze with AI
        const analysis = await analyzeIM(text);

        // Create deal if this is a new file
        const isNew = !existingMap.has(gdriveFileId);
        let dealId: string;

        if (isNew) {
          dealId = await createDealFromAnalysis(portcoId, stageId, analysis, gdriveFileId);

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
          await db
            .update(files)
            .set({ processingStatus: "completed", processedAt: new Date(), updatedAt: new Date() })
            .where(eq(files.id, existingFile.id));
        }

        // Store analysis results
        await storeResults(dealId, portcoId, analysis);

        const scores: Record<string, number> = {};
        for (const [dimId, dimResult] of Object.entries(analysis.scoring)) {
          scores[dimId] = dimResult.score;
        }
        const { weighted } = calculateWeightedScore(scores);

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

        const text = await extractPdfText(buffer);
        if (!text.trim()) throw new Error("No text extracted");

        const analysis = await analyzeIM(text);
        await storeResults(file.dealId, portcoId, analysis);

        await db
          .update(files)
          .set({ processingStatus: "completed", processedAt: new Date(), updatedAt: new Date() })
          .where(eq(files.id, file.id));

        const scores: Record<string, number> = {};
        for (const [dimId, dimResult] of Object.entries(analysis.scoring)) {
          scores[dimId] = dimResult.score;
        }
        const { weighted } = calculateWeightedScore(scores);

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

interface ProcessGdriveFileInput {
  portcoId: string;
  gdriveFileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  webViewLink: string | null;
}

interface ProcessGdriveFileResult {
  success: boolean;
  dealId?: string;
  companyName?: string;
  overallScore?: number;
  redFlagCount?: number;
  error?: string;
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

    if (existingFile?.processingStatus === "completed") {
      return { success: true, dealId: existingFile.dealId, companyName: "(already processed)" };
    }

    // Download and extract text
    progress("Downloading PDF from Google Drive...");
    const buffer = await downloadFile(portcoId, gdriveFileId);
    if (!buffer) return { success: false, error: "Failed to download from GDrive" };

    progress(`Extracting text from PDF (${(buffer.length / 1024 / 1024).toFixed(1)} MB)...`);
    const text = await extractPdfText(buffer);
    if (!text.trim()) return { success: false, error: "No text extracted from PDF" };

    progress(`Analyzing IM with AI (${text.length.toLocaleString()} chars extracted)...`);
    const analysis = await analyzeIM(text);

    let dealId: string;
    let fileId: string;

    if (existingFile) {
      // Reuse existing file + deal
      progress("Updating existing file record...");
      dealId = existingFile.dealId;
      fileId = existingFile.id;
      await db
        .update(files)
        .set({ processingStatus: "processing", updatedAt: new Date() })
        .where(eq(files.id, fileId));
    } else {
      // Create new deal
      progress(`Creating deal for "${analysis.companyProfile.companyName}"...`);
      const stageId = await getDefaultStageId(portcoId);
      dealId = await createDealFromAnalysis(portcoId, stageId, analysis, gdriveFileId);

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

    const scores: Record<string, number> = {};
    for (const [dimId, dimResult] of Object.entries(analysis.scoring)) {
      scores[dimId] = dimResult.score;
    }
    const { weighted } = calculateWeightedScore(scores);

    return {
      success: true,
      dealId,
      companyName: analysis.companyProfile.companyName,
      overallScore: weighted,
      redFlagCount: analysis.redFlags.length + analysis.infoGaps.length,
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

    // 3. Download and extract text
    const text = await getFileText(portcoId, file.gdriveFileId);

    if (!text.trim()) {
      await db
        .update(files)
        .set({ processingStatus: "failed", updatedAt: new Date() })
        .where(eq(files.id, fileId));
      return { success: false, error: "Could not extract text from PDF" };
    }

    // 4. Analyze with AI
    const analysis = await analyzeIM(text);

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

    const redFlagCount = analysis.redFlags.length + analysis.infoGaps.length;
    const scores: Record<string, number> = {};
    for (const [dimId, dimResult] of Object.entries(analysis.scoring)) {
      scores[dimId] = dimResult.score;
    }
    const { weighted } = calculateWeightedScore(scores);

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
