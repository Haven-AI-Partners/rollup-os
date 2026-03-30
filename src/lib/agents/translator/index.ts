import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { translationResultSchema, type TranslationResult } from "./schema";
import { type ContentExtractionResult, type ExtractedPage } from "@/lib/agents/content-extractor/schema";
import { buildTranslationPrompt } from "./prompt";

/**
 * Agent 2: Translator
 *
 * Takes the raw extracted content (in the original language) and produces
 * a faithful English translation, preserving all numbers, names, and formatting.
 *
 * Skips translation if the document is already in English.
 * No interpretation, no analysis, no added information.
 */
export const MODEL_ID = "gemini-2.5-flash";

/** Maximum pages per translation batch to stay within model context limits */
const BATCH_SIZE = 15;

export async function translateContent(
  extraction: ContentExtractionResult,
): Promise<TranslationResult> {
  // Skip translation for English documents
  if (extraction.metadata.documentLanguage === "en") {
    return skipTranslation(extraction);
  }

  // For large documents, translate in batches
  if (extraction.pages.length > BATCH_SIZE) {
    return translateInBatches(extraction);
  }

  return translateBatch(extraction.pages, extraction.metadata.documentLanguage);
}

/** Pass-through for documents already in English */
export function skipTranslation(extraction: ContentExtractionResult): TranslationResult {
  return {
    pages: extraction.pages.map((page: ExtractedPage) => ({
      pageNumber: page.pageNumber,
      originalContent: page.content,
      translatedContent: page.content,
    })),
    sourceLanguage: "en",
    targetLanguage: "en" as const,
  };
}

/** Translate a batch of pages */
async function translateBatch(
  pages: ContentExtractionResult["pages"],
  sourceLanguage: string,
): Promise<TranslationResult> {
  const pagesText = pages
    .map((p: ExtractedPage) => `--- Page ${p.pageNumber} ---\n${p.content}`)
    .join("\n\n");

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: translationResultSchema,
    system: await buildTranslationPrompt(),
    messages: [
      {
        role: "user",
        content: `Source language: ${sourceLanguage}\n\nTranslate the following document pages to English:\n\n${pagesText}`,
      },
    ],
    temperature: 0,
    seed: 42,
  });

  return object;
}

/** Translate large documents in batches and merge results */
async function translateInBatches(
  extraction: ContentExtractionResult,
): Promise<TranslationResult> {
  const batches: ContentExtractionResult["pages"][] = [];
  for (let i = 0; i < extraction.pages.length; i += BATCH_SIZE) {
    batches.push(extraction.pages.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) => translateBatch(batch, extraction.metadata.documentLanguage))
  );

  return {
    pages: results.flatMap((r: TranslationResult) => r.pages),
    sourceLanguage: extraction.metadata.documentLanguage,
    targetLanguage: "en" as const,
  };
}
