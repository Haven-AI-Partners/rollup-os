"use server";

import { db } from "@/lib/db";
import { files, fileExtractions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { downloadFile } from "@/lib/gdrive/client";
import { extractContent, MODEL_ID as EXTRACTOR_MODEL } from "@/lib/agents/content-extractor";
import { translateContent, skipTranslation, MODEL_ID as TRANSLATOR_MODEL } from "@/lib/agents/translator";
import { type ContentExtractionResult } from "@/lib/agents/content-extractor/schema";

const CJK_REGEX = /[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
const CJK_THRESHOLD = 0.05;

function containsCJK(extraction: ContentExtractionResult): boolean {
  const sample = extraction.pages.slice(0, 5).map((p) => p.content).join("");
  if (!sample) return false;
  const cjkChars = (sample.match(new RegExp(CJK_REGEX.source, "g")) ?? []).length;
  return cjkChars / sample.length > CJK_THRESHOLD;
}

/**
 * Extract and translate a file (Agents 1+2 only).
 * Works for any PDF — no IM-specific analysis or scoring.
 */
export async function extractFileContent(
  fileId: string,
  portcoId: string,
): Promise<{ success: boolean; error?: string }> {
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) return { success: false, error: "File not found" };
  if (!file.gdriveFileId) return { success: false, error: "File has no Google Drive ID" };

  // Mark as processing
  await db
    .update(files)
    .set({ processingStatus: "processing", updatedAt: new Date() })
    .where(eq(files.id, fileId));

  try {
    // Download PDF
    const buffer = await downloadFile(portcoId, file.gdriveFileId);
    if (!buffer) {
      await db
        .update(files)
        .set({ processingStatus: "failed", updatedAt: new Date() })
        .where(eq(files.id, fileId));
      return { success: false, error: "Failed to download from Google Drive" };
    }

    // Agent 1: Content Extraction
    const contentExtraction = await extractContent(buffer);

    // Agent 2: Translation
    const needsTranslation = contentExtraction.metadata.documentLanguage !== "en"
      || containsCJK(contentExtraction);

    const translation = needsTranslation
      ? await translateContent(contentExtraction)
      : skipTranslation(contentExtraction);

    // Persist extraction
    await db
      .insert(fileExtractions)
      .values({
        fileId,
        contentExtraction,
        translation,
        extractionModel: EXTRACTOR_MODEL,
        translationModel: TRANSLATOR_MODEL,
        pipelineVersion: "v2",
      })
      .onConflictDoUpdate({
        target: fileExtractions.fileId,
        set: {
          contentExtraction,
          translation,
          extractionModel: EXTRACTOR_MODEL,
          translationModel: TRANSLATOR_MODEL,
          pipelineVersion: "v2",
          extractedAt: new Date(),
        },
      });

    // Mark as completed
    await db
      .update(files)
      .set({ processingStatus: "completed", processedAt: new Date(), updatedAt: new Date() })
      .where(eq(files.id, fileId));

    return { success: true };
  } catch (error) {
    console.error("File extraction error:", error);

    await db
      .update(files)
      .set({ processingStatus: "failed", updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .catch(() => {});

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
