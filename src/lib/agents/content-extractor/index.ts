import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import {
  contentExtractionResultSchema,
  contentExtractionBatchSchema,
  type ContentExtractionResult,
} from "./schema";
import { buildContentExtractionPrompt } from "./prompt";

/**
 * Agent 1: Content Extractor
 *
 * Takes a PDF buffer and produces a faithful markdown transcription of each page.
 * This agent is strictly deterministic — it outputs ONLY what is visible in the document.
 * No interpretation, no translation, no analysis.
 *
 * Uses Gemini multimodal to handle both text-based and scanned/image PDFs.
 * If a single-pass extraction fails (output truncation on large/dense PDFs),
 * automatically retries by asking the model to transcribe page ranges in batches.
 */
export const MODEL_ID = "gemini-2.5-flash";

/**
 * Maximum pages per extraction batch when falling back to chunked extraction.
 * Dense Japanese IMs can produce ~1000+ output tokens per page. 5 pages keeps
 * each call well within the 65 536 output token budget.
 */
const BATCH_SIZE = 5;

/**
 * Maximum output tokens for generateObject calls.
 * Gemini 2.5 Flash supports up to 65 536 output tokens, but the default is
 * much lower (~8 192). The original code had no maxOutputTokens set, which was
 * the primary cause of truncation — the model hit the default limit mid-response.
 */
const MAX_OUTPUT_TOKENS = 65536;

export async function extractContent(pdfBuffer: Buffer): Promise<ContentExtractionResult> {
  try {
    return await extractFromPdf(pdfBuffer);
  } catch (error) {
    // If single-pass failed due to output truncation (parse error), retry in batches
    if (isOutputTruncationError(error)) {
      console.warn("Single-pass extraction failed (likely output truncation), retrying in batches...");
      return extractInBatches(pdfBuffer);
    }
    throw error;
  }
}

/** Check if the error indicates the model's output was truncated mid-JSON */
function isOutputTruncationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("no object generated")
    || msg.includes("could not parse")
    || msg.includes("json parsing failed");
}

/** Extract content from a PDF in a single pass (send full PDF buffer directly) */
async function extractFromPdf(pdfBuffer: Buffer): Promise<ContentExtractionResult> {
  try {
    const { object } = await generateObject({
      model: google(MODEL_ID),
      schema: contentExtractionResultSchema,
      system: await buildContentExtractionPrompt(),
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
              text: "Transcribe every page of this document into markdown. Output exactly what you see — do not interpret, summarize, or translate.",
            },
          ],
        },
      ],
      temperature: 0,
      seed: 42,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: {
        google: { structuredOutputs: false },
      },
    });

    return object;
  } catch (error) {
    console.error("Content extraction failed:", error);
    throw new Error(
      `Content extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Extract content by asking the model to transcribe page ranges in batches.
 * Re-sends the full PDF each time but instructs the model to only output
 * specific pages. This avoids pdfjs-dist (which requires DOM APIs unavailable
 * in Trigger.dev's Node.js runtime) while still working around output truncation.
 */
async function extractInBatches(pdfBuffer: Buffer): Promise<ContentExtractionResult> {
  const systemPrompt = await buildContentExtractionPrompt();

  // First batch: extract pages 1–BATCH_SIZE with metadata
  const firstResult = await extractPageRange(
    pdfBuffer,
    1,
    BATCH_SIZE,
    systemPrompt,
    true,
  ) as ContentExtractionResult;

  const totalPages = firstResult.metadata.totalPages;

  // If the document fits in one batch, we're done
  if (totalPages <= BATCH_SIZE) {
    return firstResult;
  }

  // Remaining batches: extract subsequent page ranges in parallel
  const batchStarts: number[] = [];
  for (let start = BATCH_SIZE + 1; start <= totalPages; start += BATCH_SIZE) {
    batchStarts.push(start);
  }

  const remainingResults = await Promise.all(
    batchStarts.map((start) => {
      const end = Math.min(start + BATCH_SIZE - 1, totalPages);
      return extractPageRange(pdfBuffer, start, end, systemPrompt, false);
    }),
  );

  // Merge all pages
  const allPages = [
    ...firstResult.pages,
    ...remainingResults.flatMap((r) => r.pages),
  ];

  return {
    pages: allPages,
    metadata: firstResult.metadata,
  };
}

/**
 * Extract a specific page range from the PDF.
 * Sends the full PDF but instructs the model to only transcribe the given range.
 */
async function extractPageRange(
  pdfBuffer: Buffer,
  startPage: number,
  endPage: number,
  systemPrompt: string,
  includeMetadata: true,
): Promise<ContentExtractionResult>;
async function extractPageRange(
  pdfBuffer: Buffer,
  startPage: number,
  endPage: number,
  systemPrompt: string,
  includeMetadata: false,
): Promise<{ pages: ContentExtractionResult["pages"] }>;
async function extractPageRange(
  pdfBuffer: Buffer,
  startPage: number,
  endPage: number,
  systemPrompt: string,
  includeMetadata: boolean,
): Promise<ContentExtractionResult | { pages: ContentExtractionResult["pages"] }> {
  const schema = includeMetadata
    ? contentExtractionResultSchema
    : contentExtractionBatchSchema;

  const rangeInstruction = `Transcribe ONLY pages ${startPage} through ${endPage} of this document into markdown. Output exactly what you see — do not interpret, summarize, or translate. Skip all pages outside this range.`;

  try {
    const { object } = await generateObject({
      model: google(MODEL_ID),
      schema,
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
              text: rangeInstruction,
            },
          ],
        },
      ],
      temperature: 0,
      seed: 42,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: {
        google: { structuredOutputs: false },
      },
    });

    return object;
  } catch (error) {
    console.error(`Content extraction failed (pages ${startPage}–${endPage}):`, error);
    throw new Error(
      `Content extraction failed (pages ${startPage}–${endPage}): ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
