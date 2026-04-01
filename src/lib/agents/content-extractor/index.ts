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
 * automatically retries by extracting one page at a time.
 */
export const MODEL_ID = "gemini-2.5-flash";

/** Max output tokens for per-page extraction (generous for single dense page) */
const MAX_OUTPUT_TOKENS = 8192;

export async function extractContent(pdfBuffer: Buffer): Promise<ContentExtractionResult> {
  try {
    return await extractFromPdf(pdfBuffer);
  } catch (error) {
    // If single-pass failed due to output truncation or schema constraint, retry page-by-page
    if (isRetryableError(error)) {
      console.warn("Single-pass extraction failed, retrying page-by-page...");
      return extractPageByPage(pdfBuffer);
    }
    throw error;
  }
}

/**
 * Check if the error is retryable via page-by-page extraction.
 * Covers output truncation (model hit token limit mid-JSON) and Gemini
 * schema constraint limits ("too many states for serving").
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("no object generated")
    || msg.includes("could not parse")
    || msg.includes("json parsing failed")
    || msg.includes("too many states");
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
 * Extract content one page at a time, then merge.
 *
 * First extracts page 1 with the full schema to get metadata (totalPages,
 * documentLanguage, documentTitle). Then extracts remaining pages in parallel
 * using the pages-only batch schema.
 *
 * Each per-page call sends the full PDF but instructs the model to only
 * transcribe a single page, keeping output well within token limits.
 */
async function extractPageByPage(pdfBuffer: Buffer): Promise<ContentExtractionResult> {
  const systemPrompt = await buildContentExtractionPrompt();

  // Page 1: use full schema to get metadata
  const firstResult = await extractSinglePage(pdfBuffer, 1, systemPrompt, true) as ContentExtractionResult;
  const totalPages = firstResult.metadata.totalPages;

  if (totalPages <= 1) {
    return firstResult;
  }

  // Remaining pages: extract in parallel with pages-only schema
  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  const remainingResults = await Promise.all(
    pageNumbers.map((page) =>
      extractSinglePage(pdfBuffer, page, systemPrompt, false),
    ),
  );

  return {
    pages: [
      ...firstResult.pages,
      ...remainingResults.flatMap((r) => r.pages),
    ],
    metadata: firstResult.metadata,
  };
}

/** Extract a single page from the PDF */
async function extractSinglePage(
  pdfBuffer: Buffer,
  pageNumber: number,
  systemPrompt: string,
  includeMetadata: true,
): Promise<ContentExtractionResult>;
async function extractSinglePage(
  pdfBuffer: Buffer,
  pageNumber: number,
  systemPrompt: string,
  includeMetadata: false,
): Promise<{ pages: ContentExtractionResult["pages"] }>;
async function extractSinglePage(
  pdfBuffer: Buffer,
  pageNumber: number,
  systemPrompt: string,
  includeMetadata: boolean,
): Promise<ContentExtractionResult | { pages: ContentExtractionResult["pages"] }> {
  const schema = includeMetadata
    ? contentExtractionResultSchema
    : contentExtractionBatchSchema;

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
              text: `Transcribe ONLY page ${pageNumber} of this document into markdown. Output exactly what you see — do not interpret, summarize, or translate. Skip all other pages.`,
            },
          ],
        },
      ],
      temperature: 0,
      seed: 42,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    return object;
  } catch (error) {
    console.error(`Content extraction failed (page ${pageNumber}):`, error);
    throw new Error(
      `Content extraction failed (page ${pageNumber}): ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
