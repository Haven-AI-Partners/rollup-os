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
    location: z.string().nullable().describe("Company headquarters location (city, prefecture), or null if not mentioned"),
    industry: z.string().nullable().describe("Primary industry or sector, or null if not mentioned"),
    askingPrice: z.string().nullable().describe("Asking price or valuation if mentioned, or null if not mentioned"),
  }),
  financialHighlights: z.object({
    revenue: z.string().nullable().describe("Most recent annual revenue as a plain number string in the original currency (e.g. '250000000' for ¥250M or '2500000' for €2.5M), or null if not mentioned"),
    ebitda: z.string().nullable().describe("Most recent annual EBITDA as a plain number string in the original currency, or null if not mentioned or not calculable"),
    currency: z.string().nullable().describe("The currency used in the IM (e.g. 'JPY', 'EUR', 'USD'), or null if unclear"),
    revenueGrowth: z.string().nullable().describe("Revenue growth trend (e.g. 'CAGR 12% over 3 years'), or null if not mentioned"),
    operatingMargin: z.string().nullable().describe("Operating margin percentage, or null if not mentioned"),
    ebitdaMargin: z.string().nullable().describe("EBITDA margin percentage, or null if not mentioned"),
    recurringRevenue: z.string().nullable().describe("Recurring revenue percentage or description, or null if not mentioned"),
    employeeCount: z.number().nullable().describe("Number of employees, or null if not mentioned"),
    topClientConcentration: z.string().nullable().describe("Top client as % of revenue, or null if not mentioned"),
    debtLevel: z.string().nullable().describe("Debt-to-equity or debt-to-EBITDA ratio, or null if not mentioned"),
  }),
  scoring: z.object({
    financial_stability: z.object({
      score: z.number().min(1).max(5).describe("Score 1-5"),
      rationale: z.string().describe("Brief justification for this score"),
      evidence: z.string().describe("Specific numbers or quotes from the IM that support this score. Write 'No relevant data found' if the IM lacks this information."),
      dataAvailable: z.boolean().describe("true if the IM contains sufficient data to score this dimension confidently, false if scoring is based on defaults or inference"),
    }),
    debt_leverage: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
      evidence: z.string(),
      dataAvailable: z.boolean(),
    }),
    org_complexity: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
      evidence: z.string(),
      dataAvailable: z.boolean(),
    }),
    technology: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
      evidence: z.string(),
      dataAvailable: z.boolean(),
    }),
    client_concentration: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
      evidence: z.string(),
      dataAvailable: z.boolean(),
    }),
    ai_readiness: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
      evidence: z.string(),
      dataAvailable: z.boolean(),
    }),
    business_model: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
      evidence: z.string(),
      dataAvailable: z.boolean(),
    }),
    integration_risk: z.object({
      score: z.number().min(1).max(5),
      rationale: z.string(),
      evidence: z.string(),
      dataAvailable: z.boolean(),
    }),
  }),
  managementTeam: z.array(
    z.object({
      name: z.string().describe("Person's full name"),
      title: z.string().describe("Job title or role (e.g. 'CEO', 'CTO', 'Division Manager', 'Advisor')"),
      department: z.string().nullable().describe("Department or division if mentioned, or null"),
      role: z.enum(["executive", "management", "staff", "board", "advisor", "contractor"]).describe("Category of this person's role in the organization"),
      reportsTo: z.string().nullable().describe("Name of the person this person reports to. Infer from context if not explicitly stated (e.g. a Division Manager likely reports to the CEO/President). Use null only for the top-level person or if truly uninferable."),
    })
  ).describe("ALL named personnel mentioned in the IM — executives, directors, managers, staff, board members, advisors, and contractors. Include everyone with a name and title/role, not just senior management. Order from top (CEO/President) down."),
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
