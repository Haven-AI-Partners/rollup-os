import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

const RENDER_SCALE = 1.5;
const IMAGE_MIME_TYPE = "image/png";

interface PageImage {
  base64: string;
  mimeType: string;
}

/**
 * Get the total page count of a PDF without rendering any pages.
 * Uses pdfjs-dist for lightweight parsing.
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let doc: PDFDocumentProxy | null = null;
  try {
    const data = new Uint8Array(pdfBuffer);
    doc = await getDocument({ data, useSystemFonts: true }).promise;
    return doc.numPages;
  } finally {
    if (doc) await doc.destroy();
  }
}

/**
 * Render the first N pages of a PDF buffer as PNG images.
 * Uses pdfjs-dist for rendering in a Node.js environment.
 * The pdfjs-dist import is deferred to avoid DOMMatrix errors in bundlers
 * that evaluate modules at build time (e.g. Trigger.dev).
 */
export async function renderPdfPagesToImages(
  pdfBuffer: Buffer,
  maxPages: number,
): Promise<PageImage[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let doc: PDFDocumentProxy | null = null;
  try {
    const data = new Uint8Array(pdfBuffer);
    doc = await getDocument({ data, useSystemFonts: true }).promise;

    const pageCount = Math.min(doc.numPages, maxPages);
    const images: PageImage[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: RENDER_SCALE });

      // Use OffscreenCanvas for Node.js environments
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdfjs-dist requires canvas + canvasContext
      await page.render({ canvas: canvas as any, canvasContext: ctx as any, viewport }).promise;

      const blob = await canvas.convertToBlob({ type: IMAGE_MIME_TYPE });
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      images.push({ base64, mimeType: IMAGE_MIME_TYPE });
    }

    return images;
  } finally {
    if (doc) await doc.destroy();
  }
}
