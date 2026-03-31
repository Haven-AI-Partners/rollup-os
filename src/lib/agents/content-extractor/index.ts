import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import {
  contentExtractionResultSchema,
  contentExtractionBatchSchema,
  type ContentExtractionResult,
} from "./schema";
import { buildContentExtractionPrompt } from "./prompt";
import { getPdfPageCount, renderPdfPagesToImages } from "@/lib/agents/shared/pdf-renderer";

/**
 * Agent 1: Content Extractor
 *
 * Takes a PDF buffer and produces a faithful markdown transcription of each page.
 * This agent is strictly deterministic — it outputs ONLY what is visible in the document.
 * No interpretation, no translation, no analysis.
 *
 * Uses Gemini multimodal to handle both text-based and scanned/image PDFs.
 * For large PDFs (>BATCH_SIZE pages), renders pages to images and processes
 * in batches to avoid output token truncation.
 */
export const MODEL_ID = "gemini-2.5-flash";

/**
 * Maximum pages per extraction batch.
 * Dense Japanese IMs can produce ~1000+ output tokens per page, and Gemini's
 * output limit is 65 536 tokens. 5 pages keeps us well within budget even for
 * the heaviest documents while still benefiting from batching.
 */
const BATCH_SIZE = 5;

/**
 * Maximum output tokens for generateObject calls.
 * Gemini 2.5 Flash supports up to 65 536 output tokens, but the default is
 * much lower (~8 192). The original code had no maxTokens set, which was the
 * primary cause of truncation — the model hit the default limit mid-response.
 */
const MAX_OUTPUT_TOKENS = 65536;

export async function extractContent(pdfBuffer: Buffer): Promise<ContentExtractionResult> {
  const pageCount = await getPdfPageCount(pdfBuffer);

  if (pageCount <= BATCH_SIZE) {
    return extractFromPdf(pdfBuffer);
  }

  return extractInBatches(pdfBuffer, pageCount);
}

/** Extract content from a small PDF (send full PDF buffer directly) */
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
      maxTokens: MAX_OUTPUT_TOKENS,
    });

    return object;
  } catch (error) {
    console.error("Content extraction failed:", error);
    throw new Error(
      `Content extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/** Extract content from a large PDF by rendering pages to images and processing in batches */
async function extractInBatches(
  pdfBuffer: Buffer,
  pageCount: number,
): Promise<ContentExtractionResult> {
  // Render all pages to images
  const allImages = await renderPdfPagesToImages(pdfBuffer, pageCount);

  // Split into batches
  const batches: { images: typeof allImages; startPage: number }[] = [];
  for (let i = 0; i < allImages.length; i += BATCH_SIZE) {
    batches.push({
      images: allImages.slice(i, i + BATCH_SIZE),
      startPage: i + 1,
    });
  }

  const systemPrompt = await buildContentExtractionPrompt();

  // First batch: use full schema to get metadata (language, title)
  const firstResult = await extractBatchWithMetadata(
    batches[0].images,
    batches[0].startPage,
    systemPrompt,
  );

  // Remaining batches: use pages-only schema, process in parallel
  const remainingResults = await Promise.all(
    batches.slice(1).map((batch) =>
      extractBatchPagesOnly(batch.images, batch.startPage, systemPrompt),
    ),
  );

  // Merge all pages
  const allPages = [
    ...firstResult.pages,
    ...remainingResults.flatMap((r) => r.pages),
  ];

  return {
    pages: allPages,
    metadata: {
      ...firstResult.metadata,
      totalPages: pageCount,
    },
  };
}

/** Extract a batch of page images with full schema (includes metadata) */
async function extractBatchWithMetadata(
  images: { base64: string; mimeType: string }[],
  startPage: number,
  systemPrompt: string,
): Promise<ContentExtractionResult> {
  try {
    const { object } = await generateObject({
      model: google(MODEL_ID),
      schema: contentExtractionResultSchema,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image" as const,
              image: img.base64,
              mimeType: img.mimeType,
            })),
            {
              type: "text" as const,
              text: `Transcribe these ${images.length} page images (pages ${startPage}–${startPage + images.length - 1}) into markdown. Output exactly what you see — do not interpret, summarize, or translate.`,
            },
          ],
        },
      ],
      temperature: 0,
      seed: 42,
      maxTokens: MAX_OUTPUT_TOKENS,
    });

    return object;
  } catch (error) {
    console.error(`Content extraction batch failed (pages ${startPage}–${startPage + images.length - 1}):`, error);
    throw new Error(
      `Content extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/** Extract a batch of page images (pages only, no metadata) */
async function extractBatchPagesOnly(
  images: { base64: string; mimeType: string }[],
  startPage: number,
  systemPrompt: string,
): Promise<{ pages: ContentExtractionResult["pages"] }> {
  try {
    const { object } = await generateObject({
      model: google(MODEL_ID),
      schema: contentExtractionBatchSchema,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image" as const,
              image: img.base64,
              mimeType: img.mimeType,
            })),
            {
              type: "text" as const,
              text: `Transcribe these ${images.length} page images (pages ${startPage}–${startPage + images.length - 1}) into markdown. Output exactly what you see — do not interpret, summarize, or translate.`,
            },
          ],
        },
      ],
      temperature: 0,
      seed: 42,
      maxTokens: MAX_OUTPUT_TOKENS,
    });

    return object;
  } catch (error) {
    console.error(`Content extraction batch failed (pages ${startPage}–${startPage + images.length - 1}):`, error);
    throw new Error(
      `Content extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
