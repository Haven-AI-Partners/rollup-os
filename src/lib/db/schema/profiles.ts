import { pgTable, uuid, text, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { deals } from "./deals";

export const companyProfiles = pgTable("company_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  summary: text("summary"),
  businessModel: text("business_model"),
  marketPosition: text("market_position"),
  financialHighlights: jsonb("financial_highlights"),
  keyRisks: jsonb("key_risks"),
  strengths: jsonb("strengths"),
  industryTrends: text("industry_trends"),
  aiOverallScore: numeric("ai_overall_score"),
  scoringBreakdown: jsonb("scoring_breakdown"),
  rawExtraction: jsonb("raw_extraction"),
  // Pipeline v2 columns
  externalEnrichment: jsonb("external_enrichment"),
  sourceAttributions: jsonb("source_attributions"),
  pipelineVersion: text("pipeline_version").default("v1"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  modelVersion: text("model_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
