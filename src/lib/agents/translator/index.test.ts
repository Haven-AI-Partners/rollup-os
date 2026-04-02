import { describe, it, expect, vi } from "vitest";
import { skipTranslation } from "./index";
import { type ContentExtractionResult } from "@/lib/agents/content-extractor/schema";

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      pages: [
        { pageNumber: 1, originalContent: "日本語テキスト", translatedContent: "Japanese text" },
      ],
      sourceLanguage: "ja",
      targetLanguage: "en",
    },
  }),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn().mockReturnValue("mock-model"),
}));

vi.mock("./prompt", () => ({
  buildTranslationPrompt: vi.fn().mockResolvedValue("translate prompt"),
}));

describe("skipTranslation", () => {
  it("passes through English content unchanged", () => {
    const extraction: ContentExtractionResult = {
      pages: [
        { pageNumber: 1, content: "# Company Overview\n\nTest Corp provides IT services.", hasDiagram: false },
        { pageNumber: 2, content: "## Financials\n\nRevenue: $10M", hasDiagram: false },
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

describe("translateContent", () => {
  it("skips translation for English documents", async () => {
    const { translateContent } = await import("./index");
    const { generateObject } = await import("ai");

    const extraction: ContentExtractionResult = {
      pages: [{ pageNumber: 1, content: "English content", hasDiagram: false }],
      metadata: { totalPages: 1, documentLanguage: "en", documentTitle: "Test" },
    };

    const result = await translateContent(extraction);

    expect(result.sourceLanguage).toBe("en");
    expect(result.targetLanguage).toBe("en");
    expect(result.pages[0].translatedContent).toBe("English content");
    // Should NOT call the AI model
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("calls AI translation for non-English documents", async () => {
    const { translateContent } = await import("./index");
    const { generateObject } = await import("ai");

    const extraction: ContentExtractionResult = {
      pages: [{ pageNumber: 1, content: "日本語テキスト", hasDiagram: false }],
      metadata: { totalPages: 1, documentLanguage: "ja", documentTitle: "テスト" },
    };

    const result = await translateContent(extraction);

    expect(generateObject).toHaveBeenCalled();
    expect(result.pages[0].translatedContent).toBe("Japanese text");
  });

  it("translates in batches for documents with more than 15 pages", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockClear();

    // Create 20 pages to trigger batching
    const pages = Array.from({ length: 20 }, (_, i) => ({
      pageNumber: i + 1,
      content: `Page ${i + 1} content in Japanese`,
      hasDiagram: false as const,
    }));

    const extraction: ContentExtractionResult = {
      pages,
      metadata: { totalPages: 20, documentLanguage: "ja", documentTitle: "Big Doc" },
    };

    // Mock generates different results for each batch
    (generateObject as any)
      .mockResolvedValueOnce({
        object: {
          pages: pages.slice(0, 15).map((p) => ({
            pageNumber: p.pageNumber,
            originalContent: p.content,
            translatedContent: `Translated ${p.content}`,
          })),
          sourceLanguage: "ja",
          targetLanguage: "en",
        },
      })
      .mockResolvedValueOnce({
        object: {
          pages: pages.slice(15).map((p) => ({
            pageNumber: p.pageNumber,
            originalContent: p.content,
            translatedContent: `Translated ${p.content}`,
          })),
          sourceLanguage: "ja",
          targetLanguage: "en",
        },
      });

    const { translateContent } = await import("./index");
    const result = await translateContent(extraction);

    // Should be called twice: batch of 15 + batch of 5
    expect(generateObject).toHaveBeenCalledTimes(2);
    expect(result.pages).toHaveLength(20);
    expect(result.sourceLanguage).toBe("ja");
  });
});
