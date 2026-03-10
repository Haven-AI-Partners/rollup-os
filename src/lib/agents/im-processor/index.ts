import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { companyProfiles, dealRedFlags, files, deals, pipelineStages, orgChartVersions, orgChartNodes } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { downloadFile, listFiles } from "@/lib/gdrive/client";
import { calculateWeightedScore } from "@/lib/scoring/rubric";
import { RED_FLAG_DEFINITIONS } from "@/lib/scoring/red-flags";
import { buildSystemPrompt } from "./prompt";
import { imAnalysisSchema, type IMAnalysisResult } from "./schema";

/**
 * IMPORTANT: Multimodal PDF input dependency
 *
 * We send PDF files directly to Gemini as binary (multimodal input) rather than
 * extracting text first. This handles both text-based and scanned/image-based PDFs.
 *
 * This approach REQUIRES a multimodal model that supports PDF file inputs.
 * Currently only supported by: Google Gemini, Anthropic Claude, Google Vertex.
 * Switching to a text-only provider (e.g. OpenAI, Mistral) will break PDF processing.
 *
 * If switching providers, you must either:
 * 1. Choose another multimodal provider that supports PDF input, OR
 * 2. Re-introduce text extraction (pdfjs-dist) + OCR for scanned PDFs
 *
 * See docs/architecture.md for more context.
 */
export const MODEL_ID = "gemini-2.5-flash";

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

/**
 * Run the IM analysis by sending the PDF directly to Gemini (multimodal).
 * This handles both text-based and scanned/image-based PDFs without separate OCR.
 */
async function analyzeIM(pdfBuffer: Buffer): Promise<IMAnalysisResult> {
  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: imAnalysisSchema,
    system: await buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: pdfBuffer,
            mediaType: "application/pdf",
          },
          {
            type: "text",
            text: "Analyze this Information Memorandum document.",
          },
        ],
      },
    ],
    temperature: 0.1,
    seed: 42,
  });

  return object;
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

  // Store org chart from management team extraction
  if (analysis.managementTeam && analysis.managementTeam.length > 0) {
    // Get next version number for this deal
    const [latestVersion] = await db
      .select({ version: orgChartVersions.version })
      .from(orgChartVersions)
      .where(eq(orgChartVersions.dealId, dealId))
      .orderBy(desc(orgChartVersions.version))
      .limit(1);

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Deactivate previous versions
    await db
      .update(orgChartVersions)
      .set({ isActive: false })
      .where(
        and(
          eq(orgChartVersions.dealId, dealId),
          eq(orgChartVersions.isActive, true),
        )
      );

    // Create new version
    const [version] = await db
      .insert(orgChartVersions)
      .values({
        dealId,
        version: nextVersion,
        label: `AI extraction v${nextVersion}`,
        isActive: true,
      })
      .returning({ id: orgChartVersions.id });

    // Insert nodes — first pass: create all nodes
    const nodeIdMap = new Map<string, string>(); // name -> db id
    const nodes = analysis.managementTeam.map((member, i) => ({
      versionId: version.id,
      name: member.name,
      title: member.title,
      department: member.department,
      position: i,
    }));

    const insertedNodes = await db
      .insert(orgChartNodes)
      .values(nodes)
      .returning({ id: orgChartNodes.id, name: orgChartNodes.name });

    for (const node of insertedNodes) {
      nodeIdMap.set(node.name, node.id);
    }

    // Second pass: set parentId based on reportsTo
    for (const member of analysis.managementTeam) {
      if (member.reportsTo) {
        const nodeId = nodeIdMap.get(member.name);
        const parentId = nodeIdMap.get(member.reportsTo);
        if (nodeId && parentId) {
          await db
            .update(orgChartNodes)
            .set({ parentId })
            .where(eq(orgChartNodes.id, nodeId));
        }
      }
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

/** Try to extract a numeric value from a string like "250,000,000" or "250000000". Returns null for non-numeric text. */
function parseNumericValue(value: string | null | undefined): string | null {
  if (!value) return null;
  // Strip commas, spaces, and common currency symbols
  const cleaned = value.replace(/[,\s¥$￥€£₩]/g, "");
  // Only attempt parse if the string is mostly digits (allow leading minus and decimal point)
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return cleaned;
}

/** Create a deal from IM analysis results */
async function createDealFromAnalysis(
  portcoId: string,
  stageId: string,
  analysis: IMAnalysisResult,
  gdriveFileId: string,
  gdriveModifiedTime?: string | null,
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
      askingPrice: parseNumericValue(analysis.companyProfile.askingPrice),
      revenue: parseNumericValue(fin.revenue),
      ebitda: parseNumericValue(fin.ebitda),
      employeeCount: fin.employeeCount ?? null,
      status: "active",
      kanbanPosition: 0,
      metadata: {
        gdriveSourceFileId: gdriveFileId,
        currency: fin.currency ?? null,
        askingPriceRaw: analysis.companyProfile.askingPrice ?? null,
        revenueRaw: fin.revenue ?? null,
        ebitdaRaw: fin.ebitda ?? null,
      },
      ...(gdriveModifiedTime ? { createdAt: new Date(gdriveModifiedTime) } : {}),
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
