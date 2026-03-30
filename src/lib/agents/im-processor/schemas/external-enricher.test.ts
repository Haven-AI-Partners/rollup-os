import { describe, it, expect } from "vitest";
import { externalEnrichmentResultSchema } from "./external-enricher";

describe("externalEnrichmentResultSchema", () => {
  it("validates full enrichment result", () => {
    const result = externalEnrichmentResultSchema.safeParse({
      companyInfo: {
        websiteUrl: "https://test-corp.co.jp",
        foundedYear: "2005",
        employeeCountExternal: "120",
        headquartersInfo: "Tokyo, Japan",
        recentNews: [
          {
            headline: "Test Corp expands AI division",
            summary: "The company announced new AI initiatives.",
            sourceUrl: "https://news.example.com/article",
            date: "2026-01-15",
          },
        ],
        keyExecutives: [
          {
            name: "Taro Yamada",
            title: "CEO",
            sourceUrl: "https://test-corp.co.jp/about",
          },
        ],
      },
      marketContext: {
        marketSize: "¥5 trillion",
        growthRate: "8% CAGR",
        keyCompetitors: ["Company A", "Company B"],
        regulatoryNotes: "New labor dispatch regulations in effect",
        industryTrends: "Shift toward cloud and AI services",
      },
      riskIndicators: [
        {
          finding: "Minor regulatory inquiry in 2025",
          sourceRef: {
            type: "external",
            url: "https://news.example.com/inquiry",
            sourceName: "Industry News",
            retrievedAt: "2026-03-30T00:00:00Z",
          },
          relevance: "low",
        },
      ],
      sources: [
        {
          url: "https://test-corp.co.jp",
          title: "Test Corp Official Website",
          retrievedAt: "2026-03-30T00:00:00Z",
        },
      ],
      searchQueries: [
        "Test Corp IT services Japan",
        "テスト株式会社 IT",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("validates empty/null enrichment result", () => {
    const result = externalEnrichmentResultSchema.safeParse({
      companyInfo: null,
      marketContext: null,
      riskIndicators: [],
      sources: [],
      searchQueries: [],
    });
    expect(result.success).toBe(true);
  });

  it("validates risk indicator relevance enum", () => {
    const result = externalEnrichmentResultSchema.safeParse({
      companyInfo: null,
      marketContext: null,
      riskIndicators: [
        {
          finding: "test",
          sourceRef: {
            type: "external",
            url: "https://example.com",
            sourceName: "test",
            retrievedAt: "2026-03-30T00:00:00Z",
          },
          relevance: "invalid",
        },
      ],
      sources: [],
      searchQueries: [],
    });
    expect(result.success).toBe(false);
  });
});
