import { z } from "zod";
import { externalSourceRefSchema } from "@/lib/agents/shared/source-attribution";

// ── Agent 4: External Enricher output schema ──

export const externalNewsItemSchema = z.object({
  headline: z.string().describe("News headline or title"),
  summary: z.string().describe("Brief summary of the article"),
  sourceUrl: z.string().describe("URL of the source article"),
  date: z.string().nullable().describe("Publication date if available, ISO format"),
});

export const externalCompanyInfoSchema = z.object({
  websiteUrl: z.string().nullable().describe("Company's official website URL"),
  foundedYear: z.string().nullable().describe("Year the company was founded"),
  employeeCountExternal: z.string().nullable().describe("Employee count from external sources (for cross-reference)"),
  headquartersInfo: z.string().nullable().describe("Headquarters location from external sources"),
  recentNews: z.array(externalNewsItemSchema).describe("Recent news articles about the company"),
  keyExecutives: z.array(z.object({
    name: z.string(),
    title: z.string(),
    sourceUrl: z.string(),
  })).describe("Key executives found in external sources (for cross-reference with IM data)"),
});

export const externalMarketContextSchema = z.object({
  marketSize: z.string().nullable().describe("Estimated market size for the company's primary market"),
  growthRate: z.string().nullable().describe("Market growth rate"),
  keyCompetitors: z.array(z.string()).describe("Known competitors in the same space"),
  regulatoryNotes: z.string().nullable().describe("Relevant regulatory environment notes"),
  industryTrends: z.string().nullable().describe("Current industry trends from external sources"),
});

export const externalRiskIndicatorSchema = z.object({
  finding: z.string().describe("Description of the risk indicator found"),
  sourceRef: externalSourceRefSchema,
  relevance: z.enum(["high", "medium", "low"]).describe("Relevance to the M&A evaluation"),
});

export const externalEnrichmentResultSchema = z.object({
  companyInfo: externalCompanyInfoSchema.nullable().describe("External company information, null if company not found online"),
  marketContext: externalMarketContextSchema.nullable().describe("Market context, null if insufficient data found"),
  riskIndicators: z.array(externalRiskIndicatorSchema).describe("External risk indicators (litigation, negative press, etc.)"),
  sources: z.array(z.object({
    url: z.string(),
    title: z.string(),
    retrievedAt: z.string().describe("ISO 8601 timestamp"),
  })).describe("All external sources consulted"),
  searchQueries: z.array(z.string()).describe("The search queries used to find this information"),
});

export type ExternalEnrichmentResult = z.infer<typeof externalEnrichmentResultSchema>;
