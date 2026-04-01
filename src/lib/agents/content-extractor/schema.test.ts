import { describe, it, expect } from "vitest";
import { contentExtractionResultSchema, contentExtractionBatchSchema } from "./schema";

describe("contentExtractionResultSchema", () => {
  it("validates correct extraction result", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [
        { pageNumber: 1, content: "# Company Overview\n\nTest Company Inc." },
      ],
      metadata: {
        totalPages: 2,
        documentLanguage: "ja",
        documentTitle: "Information Memorandum - Test Company",
      },
    });
    expect(result.success).toBe(true);
  });

  it("allows empty document title", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [{ pageNumber: 1, content: "Page content" }],
      metadata: {
        totalPages: 1,
        documentLanguage: "en",
        documentTitle: "",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects null document title", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [{ pageNumber: 1, content: "Page content" }],
      metadata: {
        totalPages: 1,
        documentLanguage: "en",
        documentTitle: null,
      },
    });
    expect(result.success).toBe(false);
  });

  it("allows empty pages array", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [],
      metadata: {
        totalPages: 0,
        documentLanguage: "ja",
        documentTitle: "",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 1 page (per-page extraction)", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [
        { pageNumber: 1, content: "Page 1" },
        { pageNumber: 2, content: "Page 2" },
      ],
      metadata: {
        totalPages: 2,
        documentLanguage: "ja",
        documentTitle: "",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing metadata", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [{ pageNumber: 1, content: "test" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("contentExtractionBatchSchema", () => {
  it("validates batch with single page", () => {
    const result = contentExtractionBatchSchema.safeParse({
      pages: [
        { pageNumber: 16, content: "# Page 16 content" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 1 page", () => {
    const result = contentExtractionBatchSchema.safeParse({
      pages: [
        { pageNumber: 16, content: "# Page 16 content" },
        { pageNumber: 17, content: "# Page 17 content" },
      ],
    });
    expect(result.success).toBe(false);
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
