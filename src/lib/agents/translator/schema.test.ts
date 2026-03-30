import { describe, it, expect } from "vitest";
import { translationResultSchema } from "./schema";

describe("translationResultSchema", () => {
  it("validates correct translation result", () => {
    const result = translationResultSchema.safeParse({
      pages: [
        {
          pageNumber: 1,
          originalContent: "# 会社概要\n\nテスト株式会社",
          translatedContent: "# Company Overview\n\nTest Corporation",
        },
      ],
      sourceLanguage: "ja",
      targetLanguage: "en",
    });
    expect(result.success).toBe(true);
  });

  it("enforces targetLanguage is 'en'", () => {
    const result = translationResultSchema.safeParse({
      pages: [{
        pageNumber: 1,
        originalContent: "test",
        translatedContent: "test",
      }],
      sourceLanguage: "ja",
      targetLanguage: "fr",
    });
    expect(result.success).toBe(false);
  });

  it("validates page structure", () => {
    const result = translationResultSchema.safeParse({
      pages: [{
        pageNumber: 1,
        // missing originalContent
        translatedContent: "test",
      }],
      sourceLanguage: "ja",
      targetLanguage: "en",
    });
    expect(result.success).toBe(false);
  });
});
