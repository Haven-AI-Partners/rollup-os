import { z } from "zod";
import { imSourceRefSchema, type IMSourceRef } from "@/lib/agents/shared/source-attribution";

// ── Agent 3: Analyzer schemas ──
// Evolved from the original schema.ts with added source attribution.

// ── Sourced field helper: value + source reference ──

function sourcedString(description: string) {
  return z.object({
    value: z.string().nullable().describe(description),
    sourceRef: imSourceRefSchema.describe("Where in the IM this data was found"),
  });
}

function sourcedNumber(description: string) {
  return z.object({
    value: z.number().nullable().describe(description),
    sourceRef: imSourceRefSchema.describe("Where in the IM this data was found"),
  });
}

// ── Sub-pass 1: Structured extraction (with source attribution) ──

const sourcedCompanyProfileSchema = z.object({
  companyName: sourcedString("The company's official name as stated in the IM"),
  summary: sourcedString("2-3 paragraph executive summary of the company"),
  businessModel: sourcedString("Description of how the company makes money, service mix, and value chain position"),
  marketPosition: sourcedString("Competitive position, market share, differentiation"),
  industryTrends: sourcedString("Relevant industry trends and how the company is positioned"),
  strengths: z.array(z.object({
    value: z.string(),
    sourceRef: imSourceRefSchema,
  })).describe("Top 5-8 key strengths with source references"),
  keyRisks: z.array(z.object({
    value: z.string(),
    sourceRef: imSourceRefSchema,
  })).describe("Top 5-8 key risks with source references"),
  location: sourcedString("Company headquarters location (city, prefecture), or null if not mentioned"),
  industry: sourcedString("Primary industry or sector, or null if not mentioned"),
  askingPrice: sourcedString("Asking price or valuation if mentioned, or null if not mentioned"),
});

const sourcedFinancialHighlightsSchema = z.object({
  revenue: sourcedString("Most recent annual revenue as a plain number string in the original currency"),
  ebitda: sourcedString("Most recent annual EBITDA as a plain number string in the original currency"),
  currency: sourcedString("The currency used in the IM (e.g. 'JPY', 'EUR', 'USD')"),
  revenueGrowth: sourcedString("Revenue growth trend (e.g. 'CAGR 12% over 3 years')"),
  operatingMargin: sourcedString("Operating margin percentage"),
  ebitdaMargin: sourcedString("EBITDA margin percentage"),
  recurringRevenue: sourcedString("Recurring revenue percentage or description"),
  employeeCount: sourcedNumber("Total number of employees (full-time + contractors combined)"),
  fullTimeCount: sourcedNumber("Number of full-time employees"),
  contractorCount: sourcedNumber("Number of contractors/contract workers"),
  topClientConcentration: sourcedString("Top client as % of revenue"),
  debtLevel: sourcedString("Debt-to-equity or debt-to-EBITDA ratio"),
});

const sourcedManagementTeamMemberSchema = z.object({
  name: z.string().describe("Person's full name"),
  title: z.string().describe("Job title or role"),
  department: z.string().nullable().describe("Department or division if mentioned"),
  role: z.enum(["executive", "management", "staff", "board", "advisor", "contractor"]),
  reportsTo: z.string().nullable().describe("Name of the person this person reports to"),
  sourceRef: imSourceRefSchema.describe("Where in the IM this person was mentioned"),
});

const sourcedRawObservationsSchema = z.object({
  clientInfo: sourcedString("Everything the IM says about clients"),
  debtInfo: sourcedString("Everything about debt, leverage, liabilities"),
  technologyInfo: sourcedString("Everything about tech stack, cloud, R&D, IP"),
  orgStructureInfo: sourcedString("Legal entities, subsidiaries, related-party transactions"),
  aiDigitalInfo: sourcedString("AI initiatives, digital transformation"),
  serviceModelInfo: sourcedString("SES vs product vs consulting breakdown"),
  integrationInfo: sourcedString("Founder plans, culture indicators, retention"),
  legalComplianceInfo: sourcedString("Litigation, regulatory, labor law, compliance"),
  laborPracticesInfo: sourcedString("Overtime practices, subcontracting, worker classification"),
});

export const analyzerExtractionSchema = z.object({
  companyProfile: sourcedCompanyProfileSchema,
  financialHighlights: sourcedFinancialHighlightsSchema,
  managementTeam: z.array(sourcedManagementTeamMemberSchema)
    .describe("ALL named personnel mentioned in the IM"),
  rawObservations: sourcedRawObservationsSchema,
});

export type AnalyzerExtractionResult = z.infer<typeof analyzerExtractionSchema>;

// ── Sub-pass 2: Scoring (unchanged from original, operates on extraction output) ──

const scoreDimensionSchema = z.object({
  score: z.number().min(1).max(5).describe("Score 1-5"),
  rationale: z.string().describe("Brief justification for this score"),
  evidence: z.string().describe("Specific numbers or quotes from the IM that support this score"),
  dataAvailable: z.boolean().describe("true if the IM contains sufficient data to score this dimension confidently"),
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
      flagId: z.string().describe("The red flag ID from the predefined list"),
      notes: z.string().describe("Specific evidence supporting this flag"),
    })
  ),
  infoGaps: z.array(
    z.object({
      flagId: z.string().describe("The info gap flag ID"),
      notes: z.string().describe("What information is missing and why it matters"),
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
