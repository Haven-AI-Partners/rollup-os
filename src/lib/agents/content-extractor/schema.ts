import { z } from "zod";

// ── Agent 1: Content Extractor output schema ──
// Field descriptions are intentionally omitted to keep the JSON Schema
// small enough for Gemini's constrained decoding (structured outputs).
// Gemini rejects schemas with "too many states" when descriptions add
// significant text. The system prompt provides all formatting guidance.

export const extractedPageSchema = z.object({
  pageNumber: z.number(),
  content: z.string(),
  hasDiagram: z.boolean(),
});

export type ExtractedPage = z.infer<typeof extractedPageSchema>;

// Schema sent to Gemini for structured output (no diagramImages — those are
// added post-extraction by rendering flagged pages with pdfjs-dist).
export const contentExtractionResultSchema = z.object({
  pages: z.array(extractedPageSchema),
  metadata: z.object({
    totalPages: z.number(),
    documentLanguage: z.string(),
    documentTitle: z.string().nullable(),
  }),
});

export type ContentExtractionResult = z.infer<typeof contentExtractionResultSchema>;

// ── Diagram image captured from PDF rendering ──

export const diagramImageSchema = z.object({
  pageNumber: z.number(),
  base64: z.string(),
  mimeType: z.literal("image/png"),
  description: z.string(),
});

export type DiagramImage = z.infer<typeof diagramImageSchema>;

// Full extraction result including rendered diagram images
export const contentExtractionWithImagesSchema = contentExtractionResultSchema.extend({
  diagramImages: z.array(diagramImageSchema).default([]),
});

export type ContentExtractionWithImages = z.infer<typeof contentExtractionWithImagesSchema>;

// ── Batch schema (pages only, no metadata — used for per-page extraction) ──

export const contentExtractionBatchSchema = z.object({
  pages: z.array(extractedPageSchema),
});

export type ContentExtractionBatchResult = z.infer<typeof contentExtractionBatchSchema>;
