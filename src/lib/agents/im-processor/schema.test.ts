import { describe, it, expect } from "vitest";
import {
  imExtractionSchema,
  imScoringSchema,
  imAnalysisSchema,
  mergeResults,
  type IMExtractionResult,
  type IMScoringResult,
} from "./schema";

function buildValidExtraction(): IMExtractionResult {
  return {
    companyProfile: {
      companyName: "Test Corp",
      summary: "A test company summary.",
      businessModel: "SES and consulting",
      marketPosition: "Mid-market player",
      industryTrends: "Growing AI adoption",
      strengths: ["Strong team", "Good retention"],
      keyRisks: ["High concentration", "Legacy tech"],
      location: "Tokyo",
      industry: "IT Services",
      askingPrice: "¥500M",
    },
    financialHighlights: {
      revenue: "250000000",
      ebitda: "50000000",
      currency: "JPY",
      revenueGrowth: "CAGR 12%",
      operatingMargin: "15%",
      ebitdaMargin: "20%",
      recurringRevenue: "40%",
      employeeCount: 100,
      topClientConcentration: "25%",
      debtLevel: "0.5x D/E",
    },
    managementTeam: [
      {
        name: "Taro Yamada",
        title: "CEO",
        department: null,
        role: "executive",
        reportsTo: null,
      },
    ],
    rawObservations: {
      clientInfo: "Top client is 25% of revenue",
      debtInfo: "Low leverage",
      technologyInfo: "Mixed stack",
      orgStructureInfo: "Single entity",
      aiDigitalInfo: "Exploring AI",
      serviceModelInfo: "60% SES, 40% consulting",
      integrationInfo: "Founder staying 3 years",
      legalComplianceInfo: "No issues mentioned",
      laborPracticesInfo: "Standard practices",
    },
  };
}

function buildValidScoring(): IMScoringResult {
  const dim = {
    score: 4,
    rationale: "Good performance",
    evidence: "Revenue growing at 12%",
    dataAvailable: true,
  };

  return {
    scoring: {
      financial_stability: dim,
      debt_leverage: dim,
      org_complexity: dim,
      technology: dim,
      client_concentration: dim,
      ai_readiness: dim,
      business_model: dim,
      integration_risk: dim,
    },
    redFlags: [
      { flagId: "mod_cli_top_30_40", notes: "Top client at 25%" },
    ],
    infoGaps: [
      { flagId: "gap_fin_no_audit", notes: "No audited financials provided" },
    ],
  };
}

describe("imExtractionSchema", () => {
  it("validates correct extraction data", () => {
    const result = imExtractionSchema.safeParse(buildValidExtraction());
    expect(result.success).toBe(true);
  });

  it("rejects missing companyName", () => {
    const data = buildValidExtraction();
    (data.companyProfile as any).companyName = undefined;
    const result = imExtractionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("allows nullable financial fields", () => {
    const data = buildValidExtraction();
    data.financialHighlights.revenue = null;
    data.financialHighlights.ebitda = null;
    const result = imExtractionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates management team roles", () => {
    const data = buildValidExtraction();
    data.managementTeam[0].role = "invalid" as any;
    const result = imExtractionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("imScoringSchema", () => {
  it("validates correct scoring data", () => {
    const result = imScoringSchema.safeParse(buildValidScoring());
    expect(result.success).toBe(true);
  });

  it("rejects score outside 1-5", () => {
    const data = buildValidScoring();
    data.scoring.financial_stability.score = 6;
    const result = imScoringSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects score below 1", () => {
    const data = buildValidScoring();
    data.scoring.financial_stability.score = 0;
    const result = imScoringSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("allows empty redFlags array", () => {
    const data = buildValidScoring();
    data.redFlags = [];
    const result = imScoringSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("allows empty infoGaps array", () => {
    const data = buildValidScoring();
    data.infoGaps = [];
    const result = imScoringSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("mergeResults", () => {
  it("combines extraction and scoring into analysis result", () => {
    const extraction = buildValidExtraction();
    const scoring = buildValidScoring();
    const merged = mergeResults(extraction, scoring);

    expect(merged.companyProfile).toEqual(extraction.companyProfile);
    expect(merged.financialHighlights).toEqual(extraction.financialHighlights);
    expect(merged.managementTeam).toEqual(extraction.managementTeam);
    expect(merged.scoring).toEqual(scoring.scoring);
    expect(merged.redFlags).toEqual(scoring.redFlags);
    expect(merged.infoGaps).toEqual(scoring.infoGaps);
  });

  it("merged result validates against imAnalysisSchema", () => {
    const merged = mergeResults(buildValidExtraction(), buildValidScoring());
    const result = imAnalysisSchema.safeParse(merged);
    expect(result.success).toBe(true);
  });
});
