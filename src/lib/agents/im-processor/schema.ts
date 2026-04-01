import { z } from "zod";

// ── Shared sub-schemas ──
// Field descriptions are intentionally omitted to keep the JSON Schema
// small enough for Gemini's constrained decoding state limit.
// The system/extraction prompts provide all guidance the model needs.

const companyProfileSchema = z.object({
  companyName: z.string(),
  summary: z.string(),
  businessModel: z.string(),
  marketPosition: z.string(),
  industryTrends: z.string(),
  strengths: z.array(z.string()),
  keyRisks: z.array(z.string()),
  location: z.string().nullable(),
  industry: z.string().nullable(),
  askingPrice: z.string().nullable(),
});

const financialHighlightsSchema = z.object({
  revenue: z.string().nullable(),
  ebitda: z.string().nullable(),
  currency: z.string().nullable(),
  revenueGrowth: z.string().nullable(),
  operatingMargin: z.string().nullable(),
  ebitdaMargin: z.string().nullable(),
  recurringRevenue: z.string().nullable(),
  employeeCount: z.number().nullable(),
  fullTimeCount: z.number().nullable(),
  contractorCount: z.number().nullable(),
  topClientConcentration: z.string().nullable(),
  debtLevel: z.string().nullable(),
});

const managementTeamMemberSchema = z.object({
  name: z.string(),
  title: z.string(),
  department: z.string().nullable(),
  role: z.enum(["executive", "management", "staff", "board", "advisor", "contractor"]),
  reportsTo: z.string().nullable(),
});

const scoreDimensionSchema = z.object({
  score: z.number(),
  rationale: z.string(),
  evidence: z.string(),
  dataAvailable: z.boolean(),
});

// ── Pass 1: Extraction (PDF → structured facts, no judgments) ──

export const imExtractionSchema = z.object({
  companyProfile: companyProfileSchema,
  financialHighlights: financialHighlightsSchema,
  managementTeam: z.array(managementTeamMemberSchema),
  rawObservations: z.object({
    clientInfo: z.string(),
    debtInfo: z.string(),
    technologyInfo: z.string(),
    orgStructureInfo: z.string(),
    aiDigitalInfo: z.string(),
    serviceModelInfo: z.string(),
    integrationInfo: z.string(),
    legalComplianceInfo: z.string(),
    laborPracticesInfo: z.string(),
  }),
});

export type IMExtractionResult = z.infer<typeof imExtractionSchema>;

// ── Pass 2: Scoring (structured facts → scores + flags) ──

export const imScoringSchema = z.object({
  scoring: z.object({
    financial_stability: scoreDimensionSchema,
    debt_leverage: scoreDimensionSchema,
    org_complexity: scoreDimensionSchema,
    technology: scoreDimensionSchema,
    client_concentration: scoreDimensionSchema,
    ai_readiness: scoreDimensionSchema,
    business_model: scoreDimensionSchema,
    integration_risk: scoreDimensionSchema,
  }),
  redFlags: z.array(
    z.object({
      flagId: z.string(),
      notes: z.string(),
    })
  ),
  infoGaps: z.array(
    z.object({
      flagId: z.string(),
      notes: z.string(),
    })
  ),
});

export type IMScoringResult = z.infer<typeof imScoringSchema>;

// ── Combined result (matches downstream expectations) ──

export const imAnalysisSchema = z.object({
  companyProfile: companyProfileSchema,
  financialHighlights: financialHighlightsSchema,
  scoring: z.object({
    financial_stability: scoreDimensionSchema,
    debt_leverage: scoreDimensionSchema,
    org_complexity: scoreDimensionSchema,
    technology: scoreDimensionSchema,
    client_concentration: scoreDimensionSchema,
    ai_readiness: scoreDimensionSchema,
    business_model: scoreDimensionSchema,
    integration_risk: scoreDimensionSchema,
  }),
  managementTeam: z.array(managementTeamMemberSchema),
  redFlags: z.array(
    z.object({
      flagId: z.string(),
      notes: z.string(),
    })
  ),
  infoGaps: z.array(
    z.object({
      flagId: z.string(),
      notes: z.string(),
    })
  ),
});

export type IMAnalysisResult = z.infer<typeof imAnalysisSchema>;

/** Merge extraction + scoring into the combined IMAnalysisResult */
export function mergeResults(extraction: IMExtractionResult, scoring: IMScoringResult): IMAnalysisResult {
  return {
    companyProfile: extraction.companyProfile,
    financialHighlights: extraction.financialHighlights,
    managementTeam: extraction.managementTeam,
    scoring: scoring.scoring,
    redFlags: scoring.redFlags,
    infoGaps: scoring.infoGaps,
  };
}
