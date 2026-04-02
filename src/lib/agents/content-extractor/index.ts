import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import {
  contentExtractionResultSchema,
  type ContentExtractionResult,
  type ContentExtractionWithImages,
  type DiagramImage,
} from "./schema";
import { buildContentExtractionPrompt } from "./prompt";

/**
 * Agent 1: Content Extractor
 *
 * Takes a PDF buffer and produces a faithful markdown transcription of each page.
 * This agent is strictly deterministic — it outputs ONLY what is visible in the document.
 * No interpretation, no translation, no analysis.
 *
 * Uses Gemini multimodal to handle both text-based and scanned/image PDFs.
 * Sends the full PDF in a single call — Gemini handles pagination internally.
 *
 * After extraction, pages flagged with hasDiagram=true are rendered as PNG images
 * using pdfjs-dist for visual fidelity in the viewer.
 */
export const MODEL_ID = "gemini-2.5-flash";

export async function extractContent(pdfBuffer: Buffer): Promise<ContentExtractionWithImages> {
  const systemPrompt = await buildContentExtractionPrompt();

  try {
    const { object } = await generateObject({
      model: google(MODEL_ID),
      schema: contentExtractionResultSchema,
      system: systemPrompt,
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
              text: "Transcribe this entire document into markdown, page by page. Output exactly what you see — do not interpret, summarize, or translate.",
            },
          ],
        },
      ],
      temperature: 0,
      seed: 42,
    });

    // Render diagram pages as PNG images for visual fidelity
    const diagramImages = await renderDiagramPages(pdfBuffer, object);

    return { ...object, diagramImages };
  } catch (error) {
    console.error("Content extraction failed:", error);
    throw new Error(
      `Content extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Extract a brief description from a page's content by looking for
 * [Chart: ...], [Image: ...], or Mermaid code blocks.
 */
export function extractDiagramDescription(content: string): string {
  const chartMatch = content.match(/\[Chart:\s*([^\]]+)\]/);
  if (chartMatch) return chartMatch[1].trim();

  const imageMatch = content.match(/\[Image:\s*([^\]]+)\]/);
  if (imageMatch) return imageMatch[1].trim();

  const mermaidMatch = content.match(/```mermaid/);
  if (mermaidMatch) return "Structural diagram";

  return "Visual content";
}

/**
 * Render PDF pages flagged as containing diagrams into PNG images.
 * Uses the existing pdf-renderer to convert specific pages.
 */
export async function renderDiagramPages(
  pdfBuffer: Buffer,
  extraction: ContentExtractionResult,
): Promise<DiagramImage[]> {
  const diagramPages = extraction.pages.filter((p) => p.hasDiagram);
  if (diagramPages.length === 0) return [];

  const maxPage = Math.max(...diagramPages.map((p) => p.pageNumber));

  try {
    // Dynamic import to avoid module resolution failures in Trigger.dev worker
    const { renderPdfPagesToImages } = await import("@/lib/agents/shared/pdf-renderer");
    const allImages = await renderPdfPagesToImages(pdfBuffer, maxPage);

    return diagramPages
      .filter((page) => allImages[page.pageNumber - 1] != null)
      .map((page) => ({
        pageNumber: page.pageNumber,
        base64: allImages[page.pageNumber - 1].base64,
        mimeType: "image/png" as const,
        description: extractDiagramDescription(page.content),
      }));
  } catch (error) {
    console.error("Failed to render diagram pages:", error);
    // Non-fatal — return empty array if rendering fails
    return [];
  }
}
