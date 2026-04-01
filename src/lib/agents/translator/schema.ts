import { z } from "zod";

// ── Agent 2: Translator output schema ──
// Field descriptions are intentionally omitted to keep the JSON Schema
// small enough for Gemini's constrained decoding state limit.

export const translatedPageSchema = z.object({
  pageNumber: z.number(),
  originalContent: z.string(),
  translatedContent: z.string(),
});

export type TranslatedPage = z.infer<typeof translatedPageSchema>;

export const translationResultSchema = z.object({
  pages: z.array(translatedPageSchema),
  sourceLanguage: z.string(),
  targetLanguage: z.literal("en"),
});

export type TranslationResult = z.infer<typeof translationResultSchema>;
