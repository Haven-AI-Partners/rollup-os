import { describe, it, expect } from "vitest";
import { skipTranslation } from "./index";
import { type ContentExtractionResult } from "@/lib/agents/content-extractor/schema";

describe("skipTranslation", () => {
  it("passes through English content unchanged", () => {
    const extraction: ContentExtractionResult = {
      pages: [
        { pageNumber: 1, content: "# Company Overview\n\nTest Corp provides IT services." },
        { pageNumber: 2, content: "## Financials\n\nRevenue: $10M" },
      ],
      metadata: {
        totalPages: 2,
        documentLanguage: "en",
        documentTitle: "IM - Test Corp",
      },
    };

    const result = skipTranslation(extraction);

    expect(result.sourceLanguage).toBe("en");
    expect(result.targetLanguage).toBe("en");
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].originalContent).toBe(extraction.pages[0].content);
    expect(result.pages[0].translatedContent).toBe(extraction.pages[0].content);
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].originalContent).toBe(extraction.pages[1].content);
    expect(result.pages[1].translatedContent).toBe(extraction.pages[1].content);
  });

  it("handles empty pages array", () => {
    const extraction: ContentExtractionResult = {
      pages: [],
      metadata: {
        totalPages: 0,
        documentLanguage: "en",
        documentTitle: null,
      },
    };

    const result = skipTranslation(extraction);

    expect(result.pages).toHaveLength(0);
    expect(result.sourceLanguage).toBe("en");
  });
});
