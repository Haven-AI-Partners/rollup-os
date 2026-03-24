import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { buildExtractionPrompt, buildScoringPrompt } from "./prompt";
import { imExtractionSchema, imScoringSchema, type IMExtractionResult } from "./schema";

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

/**
 * Pass 1: Extract structured facts from the PDF (multimodal).
 * No scoring or judgment — just facts, numbers, quotes.
 */
export async function extractFromIM(pdfBuffer: Buffer): Promise<IMExtractionResult> {
  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: imExtractionSchema,
    system: await buildExtractionPrompt(),
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
            text: "Extract all facts from this Information Memorandum document.",
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
 * Pass 2: Score the company based on structured extraction (text-only).
 * Same input every time = more consistent scores and flags.
 */
export async function scoreExtraction(extraction: IMExtractionResult, seed: number = 42) {
  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: imScoringSchema,
    system: await buildScoringPrompt(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Score this company based on the following extraction:\n\n${JSON.stringify(extraction, null, 2)}`,
          },
        ],
      },
    ],
    temperature: 0,
    seed,
  });

  return object;
}
