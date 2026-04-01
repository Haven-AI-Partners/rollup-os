import { z } from "zod";

// ── Agent 1: Content Extractor output schema ──
// Field descriptions are intentionally omitted to keep the JSON Schema
// small enough for Gemini's constrained decoding (structured outputs).
// Gemini rejects schemas with "too many states" when descriptions add
// significant text. The system prompt provides all formatting guidance.

export const extractedPageSchema = z.object({
  pageNumber: z.number(),
  content: z.string(),
});

export type ExtractedPage = z.infer<typeof extractedPageSchema>;

export const contentExtractionResultSchema = z.object({
  pages: z.array(extractedPageSchema).max(1),
  metadata: z.object({
    totalPages: z.number(),
    documentLanguage: z.string(),
    documentTitle: z.string(),
  }),
});

export type ContentExtractionResult = z.infer<typeof contentExtractionResultSchema>;

// ── Batch schema (pages only, no metadata — used for per-page extraction) ──

export const contentExtractionBatchSchema = z.object({
  pages: z.array(extractedPageSchema).max(1),
});

export type ContentExtractionBatchResult = z.infer<typeof contentExtractionBatchSchema>;
