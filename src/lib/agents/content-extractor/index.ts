import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { contentExtractionResultSchema, type ContentExtractionResult } from "./schema";
import { buildContentExtractionPrompt } from "./prompt";

/**
 * Agent 1: Content Extractor
 *
 * Takes a PDF buffer and produces a faithful markdown transcription of each page.
 * This agent is strictly deterministic — it outputs ONLY what is visible in the document.
 * No interpretation, no translation, no analysis.
 *
 * Uses Gemini multimodal to handle both text-based and scanned/image PDFs.
 */
export const MODEL_ID = "gemini-2.5-flash";

export async function extractContent(pdfBuffer: Buffer): Promise<ContentExtractionResult> {
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
}
