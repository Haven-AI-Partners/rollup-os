import { describe, it, expect } from "vitest";
import {
  extractionToDownloadable,
  type ContentExtraction,
  type Translation,
} from "./extraction-download";

const makeExtraction = (pages: { pageNumber: number; content: string }[]): ContentExtraction => ({
  pages,
  metadata: { totalPages: pages.length, documentLanguage: "en", documentTitle: null },
});

const makeTranslation = (
  pages: { pageNumber: number; originalContent: string; translatedContent: string }[],
  sourceLanguage = "ja",
): Translation => ({
  pages,
  sourceLanguage,
  targetLanguage: "en",
});

describe("extractionToDownloadable", () => {
  it("creates a markdown file from extraction pages", () => {
    const extraction = makeExtraction([
      { pageNumber: 1, content: "# Page 1\nHello" },
      { pageNumber: 2, content: "# Page 2\nWorld" },
    ]);

    const result = extractionToDownloadable("report.pdf", extraction);

    expect(result.filename).toBe("report.md");
    expect(result.mimeType).toBe("text/markdown");
    expect(result.content).toBe("# Page 1\nHello\n\n---\n\n# Page 2\nWorld");
  });

  it("strips the original extension and appends .md", () => {
    const extraction = makeExtraction([{ pageNumber: 1, content: "test" }]);

    expect(extractionToDownloadable("doc.pdf", extraction).filename).toBe("doc.md");
    expect(extractionToDownloadable("data.xlsx", extraction).filename).toBe("data.md");
    expect(extractionToDownloadable("noext", extraction).filename).toBe("noext.md");
  });

  it("uses translated content when translation is available", () => {
    const extraction = makeExtraction([
      { pageNumber: 1, content: "Japanese text" },
    ]);
    const translation = makeTranslation([
      { pageNumber: 1, originalContent: "Japanese text", translatedContent: "English text" },
    ]);

    const result = extractionToDownloadable("doc.pdf", extraction, translation);
    expect(result.content).toBe("English text");
  });

  it("falls back to original content when translation page is missing", () => {
    const extraction = makeExtraction([
      { pageNumber: 1, content: "Page 1 original" },
      { pageNumber: 2, content: "Page 2 original" },
    ]);
    const translation = makeTranslation([
      { pageNumber: 1, originalContent: "Page 1 original", translatedContent: "Page 1 translated" },
    ]);

    const result = extractionToDownloadable("doc.pdf", extraction, translation);
    expect(result.content).toBe("Page 1 translated\n\n---\n\nPage 2 original");
  });

  it("skips translation when source language is English", () => {
    const extraction = makeExtraction([
      { pageNumber: 1, content: "English content" },
    ]);
    const translation = makeTranslation(
      [{ pageNumber: 1, originalContent: "English content", translatedContent: "Same" }],
      "en",
    );

    const result = extractionToDownloadable("doc.pdf", extraction, translation);
    expect(result.content).toBe("English content");
  });

  it("handles null translation", () => {
    const extraction = makeExtraction([{ pageNumber: 1, content: "content" }]);

    const result = extractionToDownloadable("doc.pdf", extraction, null);
    expect(result.content).toBe("content");
  });
});
