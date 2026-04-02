import { describe, it, expect } from "vitest";
import {
  contentExtractionResultSchema,
  contentExtractionBatchSchema,
  diagramImageSchema,
  contentExtractionWithImagesSchema,
} from "./schema";

describe("contentExtractionResultSchema", () => {
  it("validates correct extraction result", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [
        { pageNumber: 1, content: "# Company Overview\n\nTest Company Inc.", hasDiagram: false },
        { pageNumber: 2, content: "## Financial Summary\n\nRevenue: ¥250M", hasDiagram: false },
      ],
      metadata: {
        totalPages: 2,
        documentLanguage: "ja",
        documentTitle: "Information Memorandum - Test Company",
      },
    });
    expect(result.success).toBe(true);
  });

  it("validates pages with hasDiagram flag", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [
        { pageNumber: 1, content: "# Org Chart\n\n[Image: organizational structure]", hasDiagram: true },
        { pageNumber: 2, content: "## Text page", hasDiagram: false },
      ],
      metadata: {
        totalPages: 2,
        documentLanguage: "en",
        documentTitle: null,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pages[0].hasDiagram).toBe(true);
      expect(result.data.pages[1].hasDiagram).toBe(false);
    }
  });

  it("allows null document title", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [{ pageNumber: 1, content: "Page content", hasDiagram: false }],
      metadata: {
        totalPages: 1,
        documentLanguage: "en",
        documentTitle: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it("allows empty pages array", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [],
      metadata: {
        totalPages: 0,
        documentLanguage: "ja",
        documentTitle: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing metadata", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [{ pageNumber: 1, content: "test", hasDiagram: false }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects pages missing hasDiagram", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [{ pageNumber: 1, content: "test" }],
      metadata: { totalPages: 1, documentLanguage: "en", documentTitle: null },
    });
    expect(result.success).toBe(false);
  });
});

describe("contentExtractionBatchSchema", () => {
  it("validates batch with pages only", () => {
    const result = contentExtractionBatchSchema.safeParse({
      pages: [
        { pageNumber: 16, content: "# Page 16 content", hasDiagram: false },
        { pageNumber: 17, content: "# Page 17 content", hasDiagram: true },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("allows empty pages array", () => {
    const result = contentExtractionBatchSchema.safeParse({
      pages: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing pages", () => {
    const result = contentExtractionBatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("diagramImageSchema", () => {
  it("validates a correct diagram image", () => {
    const result = diagramImageSchema.safeParse({
      pageNumber: 3,
      base64: "iVBORw0KGgoAAAANSUhEUg...",
      mimeType: "image/png",
      description: "Organizational chart",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid mimeType", () => {
    const result = diagramImageSchema.safeParse({
      pageNumber: 1,
      base64: "abc",
      mimeType: "image/jpeg",
      description: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("contentExtractionWithImagesSchema", () => {
  it("validates extraction with diagram images", () => {
    const result = contentExtractionWithImagesSchema.safeParse({
      pages: [
        { pageNumber: 1, content: "# Chart page", hasDiagram: true },
        { pageNumber: 2, content: "# Text page", hasDiagram: false },
      ],
      metadata: { totalPages: 2, documentLanguage: "en", documentTitle: null },
      diagramImages: [
        {
          pageNumber: 1,
          base64: "iVBORw0KGgoAAAANSUhEUg...",
          mimeType: "image/png",
          description: "Revenue chart",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("defaults diagramImages to empty array when missing", () => {
    const result = contentExtractionWithImagesSchema.safeParse({
      pages: [{ pageNumber: 1, content: "test", hasDiagram: false }],
      metadata: { totalPages: 1, documentLanguage: "en", documentTitle: null },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.diagramImages).toEqual([]);
    }
  });
});
