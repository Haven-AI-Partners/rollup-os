import { z } from "zod";

// ── Agent 1: Content Extractor output schema ──

export const extractedPageSchema = z.object({
  pageNumber: z.number().describe("1-based page number in the original PDF"),
  content: z.string().describe("Raw markdown transcription of this page's content. Preserve all text, tables, headers, and formatting exactly as they appear."),
});

export type ExtractedPage = z.infer<typeof extractedPageSchema>;

export const contentExtractionResultSchema = z.object({
  pages: z.array(extractedPageSchema)
    .describe("All pages from the PDF, in order. Each page's content is a faithful markdown transcription."),
  metadata: z.object({
    totalPages: z.number().describe("Total number of pages in the document"),
    documentLanguage: z.string().describe("ISO 639-1 language code of the primary language (e.g. 'ja', 'en', 'zh')"),
    documentTitle: z.string().nullable().describe("Document title if present on cover page or header, null if not found"),
  }),
});

export type ContentExtractionResult = z.infer<typeof contentExtractionResultSchema>;

// ── Batch schema (pages only, no metadata — used for subsequent batches) ──

export const contentExtractionBatchSchema = z.object({
  pages: z.array(extractedPageSchema)
    .describe("Pages from this batch of the PDF, in order. Each page's content is a faithful markdown transcription."),
});

export type ContentExtractionBatchResult = z.infer<typeof contentExtractionBatchSchema>;
