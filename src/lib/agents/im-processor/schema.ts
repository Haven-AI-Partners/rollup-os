import { z } from "zod";

// ── Shared sub-schemas ──

const companyProfileSchema = z.object({
  companyName: z.string().describe("The company's official name as stated in the IM"),
  summary: z.string().describe("2-3 paragraph executive summary of the company"),
  businessModel: z.string().describe("Description of how the company makes money, service mix, and value chain position"),
  marketPosition: z.string().describe("Competitive position, market share, differentiation"),
  industryTrends: z.string().describe("Relevant industry trends and how the company is positioned"),
  strengths: z.array(z.string()).describe("Top 5-8 key strengths"),
  keyRisks: z.array(z.string()).describe("Top 5-8 key risks"),
  location: z.string().nullable().describe("Company headquarters location (city, prefecture), or null if not mentioned"),
  industry: z.string().nullable().describe("Primary industry or sector, or null if not mentioned"),
  askingPrice: z.string().nullable().describe("Asking price or valuation if mentioned, or null if not mentioned"),
});

const financialHighlightsSchema = z.object({
  revenue: z.string().nullable().describe("Most recent annual revenue as a plain number string in the original currency (e.g. '250000000' for ¥250M or '2500000' for €2.5M), or null if not mentioned"),
  ebitda: z.string().nullable().describe("Most recent annual EBITDA as a plain number string in the original currency, or null if not mentioned or not calculable"),
  currency: z.string().nullable().describe("The currency used in the IM (e.g. 'JPY', 'EUR', 'USD'), or null if unclear"),
  revenueGrowth: z.string().nullable().describe("Revenue growth trend (e.g. 'CAGR 12% over 3 years'), or null if not mentioned"),
  operatingMargin: z.string().nullable().describe("Operating margin percentage, or null if not mentioned"),
  ebitdaMargin: z.string().nullable().describe("EBITDA margin percentage, or null if not mentioned"),
  recurringRevenue: z.string().nullable().describe("Recurring revenue percentage or description, or null if not mentioned"),
  employeeCount: z.number().nullable().describe("Total number of employees (full-time + contractors combined), or null if not mentioned"),
  fullTimeCount: z.number().nullable().describe("Number of full-time (正社員) employees, or null if not separately mentioned"),
  contractorCount: z.number().nullable().describe("Number of contractors/contract workers (業務委託/派遣社員/契約社員), or null if not separately mentioned"),
  topClientConcentration: z.string().nullable().describe("Top client as % of revenue, or null if not mentioned"),
  debtLevel: z.string().nullable().describe("Debt-to-equity or debt-to-EBITDA ratio, or null if not mentioned"),
});

const managementTeamMemberSchema = z.object({
  name: z.string().describe("Person's full name"),
  title: z.string().describe("Job title or role (e.g. 'CEO', 'CTO', 'Division Manager', 'Advisor')"),
  department: z.string().nullable().describe("Department or division if mentioned, or null"),
  role: z.enum(["executive", "management", "staff", "board", "advisor", "contractor"]).describe("Category of this person's role in the organization"),
  reportsTo: z.string().nullable().describe("Name of the person this person reports to. Infer from context if not explicitly stated (e.g. a Division Manager likely reports to the CEO/President). Use null only for the top-level person or if truly uninferable."),
});

const scoreDimensionSchema = z.object({
  score: z.number().min(1).max(5).describe("Score 1-5"),
  rationale: z.string().describe("Brief justification for this score"),
  evidence: z.string().describe("Specific numbers or quotes from the IM that support this score. Write 'No relevant data found' if the IM lacks this information."),
  dataAvailable: z.boolean().describe("true if the IM contains sufficient data to score this dimension confidently, false if scoring is based on defaults or inference"),
});

// ── Pass 1: Extraction (PDF → structured facts, no judgments) ──

export const imExtractionSchema = z.object({
  companyProfile: companyProfileSchema,
  financialHighlights: financialHighlightsSchema,
  managementTeam: z.array(managementTeamMemberSchema)
    .describe("ALL named personnel mentioned in the IM — executives, directors, managers, staff, board members, advisors, and contractors. Include everyone with a name and title/role, not just senior management. Order from top (CEO/President) down."),
  rawObservations: z.object({
    clientInfo: z.string().describe("Everything the IM says about clients: names, percentages, contract terms, concentrations, churn. Quote or paraphrase. Write 'No client information provided' if absent."),
    debtInfo: z.string().describe("Everything about debt, leverage, liabilities, guarantees. Quote or paraphrase. Write 'No debt information provided' if absent."),
    technologyInfo: z.string().describe("Everything about tech stack, cloud, R&D, IP, development processes. Write 'No technology information provided' if absent."),
    orgStructureInfo: z.string().describe("Legal entities, subsidiaries, cross-shareholding, related-party transactions. Write 'No organizational structure information provided' if absent."),
    aiDigitalInfo: z.string().describe("AI initiatives, digital transformation, innovation culture. Write 'No AI/digital information provided' if absent."),
    serviceModelInfo: z.string().describe("SES vs product vs consulting breakdown, bill rates, differentiation. Write 'No service model information provided' if absent."),
    integrationInfo: z.string().describe("Founder plans, culture indicators, retention, geographic spread. Write 'No integration-relevant information provided' if absent."),
    legalComplianceInfo: z.string().describe("Litigation, regulatory, labor law, certifications, compliance. Write 'No legal/compliance information provided' if absent."),
    laborPracticesInfo: z.string().describe("Overtime practices, subcontracting arrangements, worker classification, dispatch arrangements. Write 'No labor practices information provided' if absent."),
  }).describe("Raw observations extracted from the IM, organized by topic. These feed into the scoring pass. Extract ALL relevant facts, numbers, and direct quotes. Do NOT score or judge — just report what the IM says."),
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
      flagId: z.string().describe("The red flag ID from the predefined list (e.g. 'crit_fin_neg_cashflow')"),
      notes: z.string().describe("Specific evidence supporting this flag"),
    })
  ).describe("Red flags identified. Use exact flag IDs from the provided list. Only include flags with clear evidence."),
  infoGaps: z.array(
    z.object({
      flagId: z.string().describe("The info gap flag ID (e.g. 'gap_fin_no_audit')"),
      notes: z.string().describe("What information is missing and why it matters"),
    })
  ).describe("Information gaps - important data not present in the extraction"),
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
  managementTeam: z.array(managementTeamMemberSchema)
    .describe("ALL named personnel mentioned in the IM — executives, directors, managers, staff, board members, advisors, and contractors. Include everyone with a name and title/role, not just senior management. Order from top (CEO/President) down."),
  redFlags: z.array(
    z.object({
      flagId: z.string().describe("The red flag ID from the predefined list (e.g. 'crit_fin_neg_cashflow')"),
      notes: z.string().describe("Specific evidence from the IM supporting this flag"),
    })
  ).describe("Red flags identified in the IM. Use exact flag IDs from the provided list. Only include flags with clear evidence."),
  infoGaps: z.array(
    z.object({
      flagId: z.string().describe("The info gap flag ID (e.g. 'gap_fin_no_audit')"),
      notes: z.string().describe("What information is missing and why it matters"),
    })
  ).describe("Information gaps - important data not present in the IM"),
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
