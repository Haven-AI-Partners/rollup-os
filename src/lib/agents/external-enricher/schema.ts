import { z } from "zod";
import { externalSourceRefSchema } from "@/lib/agents/shared/source-attribution";

// ── Agent 4: External Enricher output schema ──
// Field descriptions are intentionally omitted to keep the JSON Schema
// small enough for Gemini's constrained decoding state limit.

export const externalNewsItemSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  sourceUrl: z.string(),
  date: z.string().nullable(),
});

export const externalCompanyInfoSchema = z.object({
  websiteUrl: z.string().nullable(),
  foundedYear: z.string().nullable(),
  employeeCountExternal: z.string().nullable(),
  headquartersInfo: z.string().nullable(),
  recentNews: z.array(externalNewsItemSchema),
  keyExecutives: z.array(z.object({
    name: z.string(),
    title: z.string(),
    sourceUrl: z.string(),
  })),
});

export const externalMarketContextSchema = z.object({
  marketSize: z.string().nullable(),
  growthRate: z.string().nullable(),
  keyCompetitors: z.array(z.string()),
  regulatoryNotes: z.string().nullable(),
  industryTrends: z.string().nullable(),
});

export const externalRiskIndicatorSchema = z.object({
  finding: z.string(),
  sourceRef: externalSourceRefSchema,
  relevance: z.enum(["high", "medium", "low"]),
});

export const externalEnrichmentResultSchema = z.object({
  companyInfo: externalCompanyInfoSchema.nullable(),
  marketContext: externalMarketContextSchema.nullable(),
  riskIndicators: z.array(externalRiskIndicatorSchema),
  sources: z.array(z.object({
    url: z.string(),
    title: z.string(),
    retrievedAt: z.string(),
  })),
  searchQueries: z.array(z.string()),
});

export type ExternalEnrichmentResult = z.infer<typeof externalEnrichmentResultSchema>;
