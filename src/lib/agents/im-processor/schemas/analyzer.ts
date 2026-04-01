import { z } from "zod";
import { imSourceRefSchema, type IMSourceRef } from "@/lib/agents/shared/source-attribution";

// ── Agent 3: Analyzer schemas ──
// Evolved from the original schema.ts with added source attribution.
// Field descriptions are intentionally omitted to keep the JSON Schema
// small enough for Gemini's constrained decoding state limit.

// ── Sourced field helper: value + source reference ──

function sourcedString() {
  return z.object({
    value: z.string().nullable(),
    sourceRef: imSourceRefSchema,
  });
}

function sourcedNumber() {
  return z.object({
    value: z.number().nullable(),
    sourceRef: imSourceRefSchema,
  });
}

// ── Sub-pass 1: Structured extraction (with source attribution) ──

const sourcedCompanyProfileSchema = z.object({
  companyName: sourcedString(),
  summary: sourcedString(),
  businessModel: sourcedString(),
  marketPosition: sourcedString(),
  industryTrends: sourcedString(),
  strengths: z.array(z.object({
    value: z.string(),
    sourceRef: imSourceRefSchema,
  })),
  keyRisks: z.array(z.object({
    value: z.string(),
    sourceRef: imSourceRefSchema,
  })),
  location: sourcedString(),
  industry: sourcedString(),
  askingPrice: sourcedString(),
});

const sourcedFinancialHighlightsSchema = z.object({
  revenue: sourcedString(),
  ebitda: sourcedString(),
  currency: sourcedString(),
  revenueGrowth: sourcedString(),
  operatingMargin: sourcedString(),
  ebitdaMargin: sourcedString(),
  recurringRevenue: sourcedString(),
  employeeCount: sourcedNumber(),
  fullTimeCount: sourcedNumber(),
  contractorCount: sourcedNumber(),
  topClientConcentration: sourcedString(),
  debtLevel: sourcedString(),
});

const sourcedManagementTeamMemberSchema = z.object({
  name: z.string(),
  title: z.string(),
  department: z.string().nullable(),
  role: z.enum(["executive", "management", "staff", "board", "advisor", "contractor"]),
  reportsTo: z.string().nullable(),
  sourceRef: imSourceRefSchema,
});

const sourcedRawObservationsSchema = z.object({
  clientInfo: sourcedString(),
  debtInfo: sourcedString(),
  technologyInfo: sourcedString(),
  orgStructureInfo: sourcedString(),
  aiDigitalInfo: sourcedString(),
  serviceModelInfo: sourcedString(),
  integrationInfo: sourcedString(),
  legalComplianceInfo: sourcedString(),
  laborPracticesInfo: sourcedString(),
});

export const analyzerExtractionSchema = z.object({
  companyProfile: sourcedCompanyProfileSchema,
  financialHighlights: sourcedFinancialHighlightsSchema,
  managementTeam: z.array(sourcedManagementTeamMemberSchema),
  rawObservations: sourcedRawObservationsSchema,
});

export type AnalyzerExtractionResult = z.infer<typeof analyzerExtractionSchema>;

// ── Sub-pass 2: Scoring (operates on extraction output) ──

const scoreDimensionSchema = z.object({
  score: z.number(),
  rationale: z.string(),
  evidence: z.string(),
  dataAvailable: z.boolean(),
});

export const analyzerScoringSchema = z.object({
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

export type AnalyzerScoringResult = z.infer<typeof analyzerScoringSchema>;

// ── Combined analyzer result ──

export type AnalyzerResult = {
  extraction: AnalyzerExtractionResult;
  scoring: AnalyzerScoringResult;
};

// ── Helper: flatten sourced extraction to legacy IMAnalysisResult shape ──

export function flattenSourcedExtraction(extraction: AnalyzerExtractionResult) {
  const cp = extraction.companyProfile;
  const fh = extraction.financialHighlights;

  return {
    companyProfile: {
      companyName: cp.companyName.value ?? "",
      summary: cp.summary.value ?? "",
      businessModel: cp.businessModel.value ?? "",
      marketPosition: cp.marketPosition.value ?? "",
      industryTrends: cp.industryTrends.value ?? "",
      strengths: cp.strengths.map((s: { value: string; sourceRef: IMSourceRef }) => s.value),
      keyRisks: cp.keyRisks.map((r: { value: string; sourceRef: IMSourceRef }) => r.value),
      location: cp.location.value,
      industry: cp.industry.value,
      askingPrice: cp.askingPrice.value,
    },
    financialHighlights: {
      revenue: fh.revenue.value,
      ebitda: fh.ebitda.value,
      currency: fh.currency.value,
      revenueGrowth: fh.revenueGrowth.value,
      operatingMargin: fh.operatingMargin.value,
      ebitdaMargin: fh.ebitdaMargin.value,
      recurringRevenue: fh.recurringRevenue.value,
      employeeCount: fh.employeeCount.value,
      fullTimeCount: fh.fullTimeCount.value,
      contractorCount: fh.contractorCount.value,
      topClientConcentration: fh.topClientConcentration.value,
      debtLevel: fh.debtLevel.value,
    },
    managementTeam: extraction.managementTeam.map((m: AnalyzerExtractionResult["managementTeam"][number]) => ({
      name: m.name,
      title: m.title,
      department: m.department,
      role: m.role,
      reportsTo: m.reportsTo,
    })),
  };
}

// ── Helper: collect all source references from extraction ──

export function collectSourceRefs(extraction: AnalyzerExtractionResult): Record<string, IMSourceRef> {
  const refs: Record<string, IMSourceRef> = {};

  // Company profile
  const cp = extraction.companyProfile;
  refs["companyProfile.companyName"] = cp.companyName.sourceRef;
  refs["companyProfile.summary"] = cp.summary.sourceRef;
  refs["companyProfile.businessModel"] = cp.businessModel.sourceRef;
  refs["companyProfile.marketPosition"] = cp.marketPosition.sourceRef;
  refs["companyProfile.industryTrends"] = cp.industryTrends.sourceRef;
  refs["companyProfile.location"] = cp.location.sourceRef;
  refs["companyProfile.industry"] = cp.industry.sourceRef;
  refs["companyProfile.askingPrice"] = cp.askingPrice.sourceRef;

  cp.strengths.forEach((s: { value: string; sourceRef: IMSourceRef }, i: number) => {
    refs[`companyProfile.strengths[${i}]`] = s.sourceRef;
  });
  cp.keyRisks.forEach((r: { value: string; sourceRef: IMSourceRef }, i: number) => {
    refs[`companyProfile.keyRisks[${i}]`] = r.sourceRef;
  });

  // Financial highlights
  const fh = extraction.financialHighlights;
  refs["financialHighlights.revenue"] = fh.revenue.sourceRef;
  refs["financialHighlights.ebitda"] = fh.ebitda.sourceRef;
  refs["financialHighlights.currency"] = fh.currency.sourceRef;
  refs["financialHighlights.revenueGrowth"] = fh.revenueGrowth.sourceRef;
  refs["financialHighlights.employeeCount"] = fh.employeeCount.sourceRef;

  // Management team
  extraction.managementTeam.forEach((m: AnalyzerExtractionResult["managementTeam"][number], i: number) => {
    refs[`managementTeam[${i}]`] = m.sourceRef;
  });

  return refs;
}
