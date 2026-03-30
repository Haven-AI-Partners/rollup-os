import { describe, it, expect } from "vitest";
import { contentExtractionResultSchema } from "./content-extractor";

describe("contentExtractionResultSchema", () => {
  it("validates correct extraction result", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [
        { pageNumber: 1, content: "# Company Overview\n\nTest Company Inc." },
        { pageNumber: 2, content: "## Financial Summary\n\nRevenue: ¥250M" },
      ],
      metadata: {
        totalPages: 2,
        documentLanguage: "ja",
        documentTitle: "Information Memorandum - Test Company",
      },
    });
    expect(result.success).toBe(true);
  });

  it("allows null document title", () => {
    const result = contentExtractionResultSchema.safeParse({
      pages: [{ pageNumber: 1, content: "Page content" }],
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
      pages: [{ pageNumber: 1, content: "test" }],
    });
    expect(result.success).toBe(false);
  });
});
