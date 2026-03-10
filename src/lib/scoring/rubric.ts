/**
 * IM Scoring Rubric for Japanese IT Services Companies.
 * 8 dimensions, each scored 1-5, with weighted aggregation.
 * Sub-criteria enable deterministic dimension scoring from independent judgments.
 */

export interface ScoringCriteria {
  score: number;
  label: string;
  criteria: Record<string, string>;
}

export interface SubCriterion {
  id: string;
  name: string;
  criteriaKey: string; // maps to key in criteria[].criteria objects
  defaultScore: number; // used when IM has no relevant data
}

export interface ScoringDimension {
  id: string;
  name: string;
  weight: number;
  description: string;
  whatToEvaluate: string[];
  criteria: ScoringCriteria[];
  redFlags: string[];
  subCriteria: SubCriterion[];
  defaultScore: number;
}

export const SCORE_LABELS: Record<number, string> = {
  5: "Excellent",
  4: "Good",
  3: "Acceptable",
  2: "Concerning",
  1: "Poor",
};

export const RECOMMENDATION_BANDS = [
  { min: 4.0, max: 5.0, label: "Strong Candidate", description: "Proceed confidently" },
  { min: 3.5, max: 3.99, label: "Good Candidate", description: "Address identified risks" },
  { min: 3.0, max: 3.49, label: "Acceptable", description: "Significant due diligence required" },
  { min: 2.5, max: 2.99, label: "Marginal", description: "Only if strategic rationale is compelling" },
  { min: 0, max: 2.49, label: "High Risk", description: "Pass unless exceptional circumstances" },
] as const;

export const SCORING_DIMENSIONS: ScoringDimension[] = [
  {
    id: "financial_stability",
    name: "Financial Stability",
    weight: 0.20,
    description: "Revenue trends, profitability, cash flow, and revenue predictability",
    defaultScore: 3,
    subCriteria: [
      { id: "revenue_growth", name: "Revenue Growth (3yr CAGR)", criteriaKey: "revenueGrowth", defaultScore: 3 },
      { id: "operating_margin", name: "Operating/EBITDA Margin", criteriaKey: "operatingMargin", defaultScore: 3 },
      { id: "cash_flow", name: "Cash Flow Generation", criteriaKey: "cashFlow", defaultScore: 3 },
      { id: "recurring_revenue", name: "Revenue Predictability", criteriaKey: "recurringRevenue", defaultScore: 3 },
    ],
    whatToEvaluate: [
      "Revenue trend (3-year CAGR)",
      "Profitability (operating margin, EBITDA margin)",
      "Cash flow generation (operating cash flow / revenue)",
      "Working capital health (current ratio, days sales outstanding)",
      "Revenue predictability (recurring vs. project-based)",
    ],
    criteria: [
      { score: 5, label: "Excellent", criteria: { revenueGrowth: "CAGR >15%", operatingMargin: ">20%", cashFlow: "Strong positive", recurringRevenue: ">70% recurring" } },
      { score: 4, label: "Good", criteria: { revenueGrowth: "CAGR 10-15%", operatingMargin: "15-20%", cashFlow: "Positive", recurringRevenue: "50-70% recurring" } },
      { score: 3, label: "Acceptable", criteria: { revenueGrowth: "CAGR 5-10%", operatingMargin: "10-15%", cashFlow: "Break-even", recurringRevenue: "30-50% recurring" } },
      { score: 2, label: "Concerning", criteria: { revenueGrowth: "CAGR 0-5%", operatingMargin: "5-10%", cashFlow: "Weak/negative", recurringRevenue: "10-30% recurring" } },
      { score: 1, label: "Poor", criteria: { revenueGrowth: "Declining", operatingMargin: "<5% or negative", cashFlow: "Negative", recurringRevenue: "<10% recurring" } },
    ],
    redFlags: [
      "Declining revenue for 2+ consecutive years",
      "Negative operating margins",
      "Persistent negative cash flow",
      "Heavy reliance on one-off project revenue",
    ],
  },
  {
    id: "debt_leverage",
    name: "Debt & Financial Leverage",
    weight: 0.12,
    description: "Debt ratios, interest coverage, and liability profile",
    defaultScore: 3,
    subCriteria: [
      { id: "debt_equity", name: "Debt-to-Equity Ratio", criteriaKey: "debtEquity", defaultScore: 3 },
      { id: "debt_ebitda", name: "Debt-to-EBITDA Ratio", criteriaKey: "debtEbitda", defaultScore: 3 },
      { id: "interest_coverage", name: "Interest Coverage", criteriaKey: "interestCoverage", defaultScore: 3 },
      { id: "debt_profile", name: "Debt Maturity Profile", criteriaKey: "profile", defaultScore: 3 },
    ],
    whatToEvaluate: [
      "Debt-to-equity ratio",
      "Debt-to-EBITDA ratio",
      "Interest coverage ratio",
      "Debt maturity profile",
      "Contingent liabilities",
    ],
    criteria: [
      { score: 5, label: "Excellent", criteria: { debtEquity: "<0.3x", debtEbitda: "<1.0x", interestCoverage: ">10x", profile: "No debt or long-term only" } },
      { score: 4, label: "Good", criteria: { debtEquity: "0.3-0.7x", debtEbitda: "1.0-2.0x", interestCoverage: "5-10x", profile: "Well-structured, >3yr maturity" } },
      { score: 3, label: "Acceptable", criteria: { debtEquity: "0.7-1.5x", debtEbitda: "2.0-3.5x", interestCoverage: "3-5x", profile: "Mixed, some near-term debt" } },
      { score: 2, label: "Concerning", criteria: { debtEquity: "1.5-3.0x", debtEbitda: "3.5-5.0x", interestCoverage: "1.5-3x", profile: "Heavy near-term obligations" } },
      { score: 1, label: "Poor", criteria: { debtEquity: ">3.0x", debtEbitda: ">5.0x", interestCoverage: "<1.5x", profile: "Distressed, refinancing risk" } },
    ],
    redFlags: [
      "Short-term debt exceeds operating cash flow",
      "Debt covenants at risk of breach",
      "Hidden liabilities (guarantees, off-balance-sheet)",
      "Recent covenant waivers",
    ],
  },
  {
    id: "org_complexity",
    name: "Organizational Complexity",
    weight: 0.06,
    description: "Corporate structure, related-party transactions, and integration risk",
    defaultScore: 4,
    subCriteria: [
      { id: "entity_structure", name: "Legal Entity Structure", criteriaKey: "structure", defaultScore: 4 },
      { id: "related_party", name: "Related-Party Transactions", criteriaKey: "relatedParty", defaultScore: 4 },
      { id: "integration_complexity", name: "Structural Integration Risk", criteriaKey: "integrationRisk", defaultScore: 4 },
    ],
    whatToEvaluate: [
      "Number of legal entities (subsidiaries, affiliates)",
      "Cross-shareholding structures",
      "Related-party transactions",
      "Decision-making hierarchy",
      "Geographic footprint complexity",
    ],
    criteria: [
      { score: 5, label: "Excellent", criteria: { structure: "Single entity, clean cap table", relatedParty: "None", integrationRisk: "Minimal" } },
      { score: 4, label: "Good", criteria: { structure: "1-2 subsidiaries, clear structure", relatedParty: "Disclosed, arm's length", integrationRisk: "Low" } },
      { score: 3, label: "Acceptable", criteria: { structure: "3-5 entities, some complexity", relatedParty: "Some non-standard terms", integrationRisk: "Moderate" } },
      { score: 2, label: "Concerning", criteria: { structure: "6-10 entities, unclear rationale", relatedParty: "Material, complex pricing", integrationRisk: "High" } },
      { score: 1, label: "Poor", criteria: { structure: ">10 entities, opaque structure", relatedParty: "Extensive, conflict concerns", integrationRisk: "Very high" } },
    ],
    redFlags: [
      "Circular ownership structures",
      "Material related-party transactions without clear business rationale",
      "Subsidiaries in tax havens without operational justification",
      "Founder-controlled entities transacting with target",
    ],
  },
  {
    id: "technology",
    name: "Technology & Technical Capability",
    weight: 0.15,
    description: "Tech stack modernity, cloud adoption, talent, and R&D investment",
    defaultScore: 3,
    subCriteria: [
      { id: "tech_stack", name: "Technology Stack Modernity", criteriaKey: "stack", defaultScore: 3 },
      { id: "cloud_adoption", name: "Cloud Adoption", criteriaKey: "cloud", defaultScore: 3 },
      { id: "talent_retention", name: "Technical Talent & Retention", criteriaKey: "talent", defaultScore: 3 },
      { id: "rd_investment", name: "R&D Investment", criteriaKey: "rdInvestment", defaultScore: 3 },
    ],
    whatToEvaluate: [
      "Technology stack modernity (languages, frameworks, infrastructure)",
      "Cloud adoption level",
      "DevOps/automation maturity",
      "Technical talent quality and retention",
      "R&D investment as % of revenue",
      "IP ownership (vs. client-owned work)",
    ],
    criteria: [
      { score: 5, label: "Excellent", criteria: { stack: "Modern (cloud-native)", cloud: ">70% cloud", talent: "Strong retention, sought-after skills", rdInvestment: ">10% of revenue" } },
      { score: 4, label: "Good", criteria: { stack: "Mostly modern", cloud: "40-70% cloud", talent: "Good retention", rdInvestment: "5-10% of revenue" } },
      { score: 3, label: "Acceptable", criteria: { stack: "Mixed legacy/modern", cloud: "20-40% cloud", talent: "Average retention", rdInvestment: "2-5% of revenue" } },
      { score: 2, label: "Concerning", criteria: { stack: "Primarily legacy", cloud: "<20% cloud", talent: "High turnover", rdInvestment: "<2% of revenue" } },
      { score: 1, label: "Poor", criteria: { stack: "Obsolete tech debt", cloud: "On-prem only", talent: "Exodus of key talent", rdInvestment: "Minimal/none" } },
    ],
    redFlags: [
      "Critical systems on unsupported platforms (e.g., Windows Server 2008)",
      "No cloud strategy or failed cloud migration attempts",
      "Heavy reliance on outsourced development with no in-house capability",
      "Key technical staff threatening departure post-acquisition",
    ],
  },
  {
    id: "client_concentration",
    name: "Client Concentration & Revenue Distribution",
    weight: 0.20,
    description: "Revenue concentration, contract terms, and client diversity",
    defaultScore: 3,
    subCriteria: [
      { id: "top_client_pct", name: "Top Client Concentration", criteriaKey: "topClient", defaultScore: 3 },
      { id: "top3_clients_pct", name: "Top 3 Clients Concentration", criteriaKey: "top3", defaultScore: 3 },
      { id: "top5_clients_pct", name: "Top 5 Clients Concentration", criteriaKey: "top5", defaultScore: 3 },
      { id: "contract_quality", name: "Contract Terms & Diversity", criteriaKey: "profile", defaultScore: 3 },
    ],
    whatToEvaluate: [
      "Top client as % of revenue",
      "Top 3 clients as % of revenue",
      "Top 5 clients as % of revenue",
      "Client contract terms (length, renewal rates)",
      "Client diversity (industry, size)",
      "Historical client churn",
    ],
    criteria: [
      { score: 5, label: "Excellent", criteria: { topClient: "<10%", top3: "<25%", top5: "<35%", profile: "Diversified, multi-year contracts" } },
      { score: 4, label: "Good", criteria: { topClient: "10-20%", top3: "25-40%", top5: "35-50%", profile: "Good diversity, annual+ contracts" } },
      { score: 3, label: "Acceptable", criteria: { topClient: "20-30%", top3: "40-55%", top5: "50-65%", profile: "Some concentration risk" } },
      { score: 2, label: "Concerning", criteria: { topClient: "30-45%", top3: "55-70%", top5: "65-80%", profile: "High concentration, short contracts" } },
      { score: 1, label: "Poor", criteria: { topClient: ">45%", top3: ">70%", top5: ">80%", profile: "Single-client dependency" } },
    ],
    redFlags: [
      "Single client >40% of revenue",
      "Top 3 clients >70% of revenue",
      "Recent loss of major client (>15% revenue)",
      "Contracts <12 months with top clients",
      "Verbal/informal agreements for major clients",
    ],
  },
  {
    id: "ai_readiness",
    name: "AI & Digital Transformation Readiness",
    weight: 0.10,
    description: "AI initiatives, leadership enthusiasm, data infrastructure, and innovation culture",
    defaultScore: 2,
    subCriteria: [
      { id: "ai_initiatives", name: "AI/ML Initiatives", criteriaKey: "aiInitiatives", defaultScore: 2 },
      { id: "leadership_support", name: "Leadership AI Enthusiasm", criteriaKey: "leadership", defaultScore: 2 },
      { id: "data_infrastructure", name: "Data Infrastructure", criteriaKey: "dataInfra", defaultScore: 2 },
      { id: "innovation_culture", name: "Innovation Culture", criteriaKey: "culture", defaultScore: 2 },
    ],
    whatToEvaluate: [
      "AI/ML initiatives (current or planned)",
      "Executive understanding and enthusiasm for AI",
      "Data infrastructure quality",
      "Willingness to invest in innovation",
      "Cultural openness to change",
      "Existing digital service offerings",
    ],
    criteria: [
      { score: 5, label: "Excellent", criteria: { aiInitiatives: "Active AI projects in production", leadership: "Strong champion", dataInfra: "Modern data platform", culture: "High investment, experimentation" } },
      { score: 4, label: "Good", criteria: { aiInitiatives: "AI pilots or proof-of-concepts", leadership: "Supportive", dataInfra: "Good data quality", culture: "Regular innovation budget" } },
      { score: 3, label: "Acceptable", criteria: { aiInitiatives: "Exploring AI, no projects yet", leadership: "Neutral/learning", dataInfra: "Basic data capabilities", culture: "Some innovation investment" } },
      { score: 2, label: "Concerning", criteria: { aiInitiatives: "Aware but no concrete plans", leadership: "Skeptical", dataInfra: "Poor data quality", culture: "Minimal innovation spend" } },
      { score: 1, label: "Poor", criteria: { aiInitiatives: "Unaware or dismissive", leadership: "Resistant", dataInfra: "No data strategy", culture: "Innovation-averse" } },
    ],
    redFlags: [
      "Senior leadership explicitly resistant to AI adoption",
      "\"We've always done it this way\" culture",
      "Zero budget allocated for innovation",
      "No data collection or analysis capabilities",
      "Staff fear of automation/modernization",
    ],
  },
  {
    id: "business_model",
    name: "Business Model & Service Mix",
    weight: 0.12,
    description: "Service portfolio, value positioning, scalability, and differentiation",
    defaultScore: 3,
    subCriteria: [
      { id: "service_model", name: "Service Model Mix", criteriaKey: "serviceModel", defaultScore: 3 },
      { id: "value_position", name: "Value Positioning", criteriaKey: "valuePosition", defaultScore: 3 },
      { id: "scalability", name: "Scalability", criteriaKey: "scalability", defaultScore: 3 },
      { id: "differentiation", name: "Differentiation", criteriaKey: "differentiation", defaultScore: 3 },
    ],
    whatToEvaluate: [
      "Service portfolio (SES vs. product/platform vs. consulting)",
      "Value-add level (commodity labor vs. strategic advisory)",
      "Pricing power (market-driven vs. cost-plus)",
      "Scalability of service offerings",
      "Differentiation vs. competitors",
    ],
    criteria: [
      { score: 5, label: "Excellent", criteria: { serviceModel: "Product/platform revenue >40%", valuePosition: "Strategic advisory", scalability: "High leverage", differentiation: "Unique IP/capability" } },
      { score: 4, label: "Good", criteria: { serviceModel: "Mixed, <30% pure SES", valuePosition: "Solution delivery", scalability: "Moderate leverage", differentiation: "Strong differentiation" } },
      { score: 3, label: "Acceptable", criteria: { serviceModel: "Mostly project-based", valuePosition: "Custom development", scalability: "Low leverage", differentiation: "Some differentiation" } },
      { score: 2, label: "Concerning", criteria: { serviceModel: "Heavy SES (40-70%)", valuePosition: "Body shopping", scalability: "No leverage", differentiation: "Commodity services" } },
      { score: 1, label: "Poor", criteria: { serviceModel: "Pure SES (>70%)", valuePosition: "Labor arbitrage", scalability: "Negative leverage", differentiation: "No differentiation" } },
    ],
    redFlags: [
      "Pure SES model with no upmarket evolution path",
      "Declining bill rates or margin compression",
      "Loss of contracts to cheaper offshore providers",
      "No proprietary tools, frameworks, or methodologies",
    ],
  },
  {
    id: "integration_risk",
    name: "Post-Merger Integration Risk",
    weight: 0.05,
    description: "Cultural fit, management continuity, and systems integration complexity",
    defaultScore: 3,
    subCriteria: [
      { id: "cultural_fit", name: "Cultural Fit", criteriaKey: "culturalFit", defaultScore: 3 },
      { id: "management_continuity", name: "Management Continuity", criteriaKey: "management", defaultScore: 3 },
      { id: "systems_complexity", name: "Systems Integration", criteriaKey: "complexity", defaultScore: 3 },
    ],
    whatToEvaluate: [
      "Cultural fit with acquirer",
      "Founder/management transition plan",
      "Employee retention risks",
      "Systems integration complexity",
      "Geographic integration challenges",
      "Regulatory/compliance alignment",
    ],
    criteria: [
      { score: 5, label: "Excellent", criteria: { culturalFit: "Highly aligned values", management: "Strong team staying 3+ years", complexity: "Minimal systems overlap" } },
      { score: 4, label: "Good", criteria: { culturalFit: "Compatible culture", management: "Key leaders staying 2+ years", complexity: "Low complexity" } },
      { score: 3, label: "Acceptable", criteria: { culturalFit: "Some cultural differences", management: "Mixed commitment", complexity: "Moderate complexity" } },
      { score: 2, label: "Concerning", criteria: { culturalFit: "Significant cultural gaps", management: "Founder exit within 1 year", complexity: "High complexity" } },
      { score: 1, label: "Poor", criteria: { culturalFit: "Culture clash likely", management: "Mass exodus risk", complexity: "Integration nightmare" } },
    ],
    redFlags: [
      "Founder/key employees planning immediate exit",
      "\"Lifestyle business\" with no growth ambition",
      "Incompatible work culture (e.g., rigid hierarchy vs. flat org)",
      "Legacy systems requiring complete replacement",
      "Geographic challenges (e.g., remote offices with no clear plan)",
    ],
  },
];

/** Japan-specific market benchmarks for IT services M&A */
export const JP_MARKET_NORMS = {
  billRates: "3,000-10,000/hour depending on skill level",
  operatingMargins: "10-20% typical for SI firms",
  employeeUtilization: "70-85% billable target",
  clientPaymentTerms: "Net 30-60 days standard",
} as const;

/**
 * Compute a dimension score deterministically from sub-scores.
 * Null sub-scores are replaced with defaults. Returns average rounded to 1 decimal.
 */
export function computeDimensionScore(
  dimensionId: string,
  subScores: Array<{ id: string; score: number | null }>
): number {
  const dimension = SCORING_DIMENSIONS.find((d) => d.id === dimensionId);
  if (!dimension) return 3;

  // Resolve null scores to defaults
  const resolved = subScores.map((s) => {
    if (s.score !== null) return s.score;
    const sub = dimension.subCriteria.find((sc) => sc.id === s.id);
    return sub?.defaultScore ?? dimension.defaultScore;
  });

  if (resolved.length === 0) return dimension.defaultScore;

  const avg = resolved.reduce((sum, s) => sum + s, 0) / resolved.length;
  return Math.round(avg * 10) / 10;
}

/** Calculate weighted score from dimension scores */
export function calculateWeightedScore(
  scores: Record<string, number>
): { weighted: number; recommendation: string; description: string } {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of SCORING_DIMENSIONS) {
    const score = scores[dim.id];
    if (score !== undefined) {
      weightedSum += score * dim.weight;
      totalWeight += dim.weight;
    }
  }

  const weighted = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const band = RECOMMENDATION_BANDS.find((b) => weighted >= b.min) ?? RECOMMENDATION_BANDS[RECOMMENDATION_BANDS.length - 1];

  return {
    weighted: Math.round(weighted * 100) / 100,
    recommendation: band.label,
    description: band.description,
  };
}
