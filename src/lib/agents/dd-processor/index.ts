import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { dealThesisNodes, files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { downloadFile } from "@/lib/gdrive/client";
import { ddExtractionSchema, type DDExtractionResult } from "./schema";
import { buildDDProcessorPrompt } from "./prompt";
import type { FileType } from "@/lib/db/schema/files";

export const MODEL_ID = "gemini-2.5-flash";

interface ProcessDDInput {
  fileId: string;
  dealId: string;
  portcoId: string;
  fileType: FileType;
}

interface ProcessDDResult {
  success: boolean;
  nodesUpdated: number;
  summary?: string;
  error?: string;
}

/**
 * Extract structured findings from a DD document PDF via multimodal LLM.
 */
async function extractFromDocument(
  pdfBuffer: Buffer,
  fileType: FileType,
): Promise<DDExtractionResult> {
  const systemPrompt = await buildDDProcessorPrompt(fileType);

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: ddExtractionSchema,
    system: systemPrompt,
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
            text: "Extract all relevant due diligence findings from this document and map them to thesis tree nodes.",
          },
        ],
      },
    ],
    temperature: 0,
    seed: 42,
  });

  return object;
}

/**
 * Update thesis tree nodes with findings from a DD document.
 * Only updates nodes that exist for the deal and where the new finding
 * provides better data (upgrades unknown→partial→complete).
 */
async function enrichThesisNodes(
  dealId: string,
  fileId: string,
  findings: DDExtractionResult["findings"],
): Promise<number> {
  if (findings.length === 0) return 0;

  // Load existing thesis nodes for this deal
  const existingNodes = await db
    .select({
      id: dealThesisNodes.id,
      templateNodeId: dealThesisNodes.templateNodeId,
      status: dealThesisNodes.status,
    })
    .from(dealThesisNodes)
    .where(eq(dealThesisNodes.dealId, dealId));

  const templateIdToNode = new Map(
    existingNodes
      .filter((n) => n.templateNodeId)
      .map((n) => [n.templateNodeId!, n]),
  );

  const STATUS_RANK: Record<string, number> = {
    unknown: 0,
    partial: 1,
    complete: 2,
    risk: 2, // risk is equivalent priority to complete
  };

  let updated = 0;

  for (const finding of findings) {
    const node = templateIdToNode.get(finding.templateNodeId);
    if (!node) continue;

    // Only upgrade status, never downgrade (except to risk which is always relevant)
    const currentRank = STATUS_RANK[node.status] ?? 0;
    const newRank = STATUS_RANK[finding.status] ?? 0;
    if (newRank < currentRank && finding.status !== "risk") continue;

    await db
      .update(dealThesisNodes)
      .set({
        status: finding.status,
        value: finding.value,
        notes: finding.notes,
        source: "dd_extracted",
        sourceDetail: fileId,
        updatedAt: new Date(),
      })
      .where(eq(dealThesisNodes.id, node.id));

    updated++;
  }

  return updated;
}

/**
 * Process a DD document end-to-end:
 * 1. Download PDF from GDrive
 * 2. Extract findings via multimodal LLM
 * 3. Enrich thesis tree nodes with findings
 * 4. Update file processing status
 */
export async function processDDDocument(
  input: ProcessDDInput,
): Promise<ProcessDDResult> {
  const { fileId, dealId, portcoId, fileType } = input;

  try {
    // Get file record
    const [file] = await db
      .select({ gdriveFileId: files.gdriveFileId })
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file?.gdriveFileId) {
      return { success: false, nodesUpdated: 0, error: "File has no GDrive ID" };
    }

    // Mark as processing
    await db
      .update(files)
      .set({ processingStatus: "processing", updatedAt: new Date() })
      .where(eq(files.id, fileId));

    // Download PDF
    const buffer = await downloadFile(portcoId, file.gdriveFileId);
    if (!buffer) {
      await db
        .update(files)
        .set({ processingStatus: "failed", updatedAt: new Date() })
        .where(eq(files.id, fileId));
      return { success: false, nodesUpdated: 0, error: "Download failed" };
    }

    // Extract findings
    const extraction = await extractFromDocument(buffer, fileType);

    // Enrich thesis tree
    const nodesUpdated = await enrichThesisNodes(dealId, fileId, extraction.findings);

    // Mark complete
    await db
      .update(files)
      .set({
        processingStatus: "completed",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));

    return {
      success: true,
      nodesUpdated,
      summary: extraction.summary,
    };
  } catch (error) {
    console.error(`DD processing failed for file ${fileId}:`, error);

    await db
      .update(files)
      .set({ processingStatus: "failed", updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .catch(() => {});

    return {
      success: false,
      nodesUpdated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
