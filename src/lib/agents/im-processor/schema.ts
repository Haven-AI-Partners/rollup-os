import { z } from "zod";

/** Structured output schema for IM analysis */
export const imAnalysisSchema = z.object({
  companyProfile: z.object({
    companyName: z.string().describe("The company's official name as stated in the IM"),
    summary: z.string().describe("2-3 paragraph executive summary of the company"),
    businessModel: z.string().describe("Description of how the company makes money, service mix, and value chain position"),
    marketPosition: z.string().describe("Competitive position, market share, differentiation"),
    industryTrends: z.string().describe("Relevant industry trends and how the company is positioned"),
    strengths: z.array(z.string()).describe("Top 5-8 key strengths"),
    keyRisks: z.array(z.string()).describe("Top 5-8 key risks"),
    location: z.string().optional().describe("Company headquarters location (city, prefecture)"),
    industry: z.string().optional().describe("Primary industry or sector"),
    askingPrice: z.string().optional().describe("Asking price or valuation if mentioned"),
  }),
  financialHighlights: z.object({
    revenue: z.string().optional().describe("Most recent annual revenue"),
    revenueGrowth: z.string().optional().describe("Revenue growth trend (e.g. 'CAGR 12% over 3 years')"),
    operatingMargin: z.string().optional().describe("Operating margin percentage"),
    ebitdaMargin: z.string().optional().describe("EBITDA margin percentage"),
    recurringRevenue: z.string().optional().describe("Recurring revenue percentage or description"),
    employeeCount: z.number().optional().describe("Number of employees"),
    topClientConcentration: z.string().optional().describe("Top client as % of revenue"),
    debtLevel: z.string().optional().describe("Debt-to-equity or debt-to-EBITDA ratio"),
  }),
  scoring: z.object({
    financial_stability: z.object({
      score: z.number().min(1).max(5).describe("Score 1-5"),
      rationale: z.string().describe("Brief justification for this score"),
    }),
    debt_leverage: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
    }),
    org_complexity: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
    }),
    technology: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
    }),
    client_concentration: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
    }),
    ai_readiness: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
    }),
    business_model: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
    }),
    integration_risk: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
    }),
  }),
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
