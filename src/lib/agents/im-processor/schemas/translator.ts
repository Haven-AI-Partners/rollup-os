import { z } from "zod";

// ── Agent 2: Translator output schema ──

export const translatedPageSchema = z.object({
  pageNumber: z.number().describe("1-based page number matching the original PDF"),
  originalContent: z.string().describe("Original content in source language (preserved for reference)"),
  translatedContent: z.string().describe("Faithful English translation of the page content"),
});

export type TranslatedPage = z.infer<typeof translatedPageSchema>;

export const translationResultSchema = z.object({
  pages: z.array(translatedPageSchema)
    .describe("All pages with original and translated content, in order"),
  sourceLanguage: z.string().describe("ISO 639-1 code of the source language (e.g. 'ja')"),
  targetLanguage: z.literal("en").describe("Target language is always English"),
});

export type TranslationResult = z.infer<typeof translationResultSchema>;
