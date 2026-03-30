import { describe, it, expect } from "vitest";
import {
  analyzerExtractionSchema,
  analyzerScoringSchema,
  flattenSourcedExtraction,
  collectSourceRefs,
  type AnalyzerExtractionResult,
} from "./analyzer";

function buildSourceRef(pageNumbers: number[] = [1], quote: string = "Test quote") {
  return { type: "im_document" as const, pageNumbers, quote };
}

function buildSourcedString(value: string | null, pageNumbers: number[] = [1]) {
  return { value, sourceRef: buildSourceRef(pageNumbers, value ?? "Not mentioned") };
}

function buildSourcedNumber(value: number | null, pageNumbers: number[] = [1]) {
  return { value, sourceRef: buildSourceRef(pageNumbers, String(value ?? "Not mentioned")) };
}

function buildValidAnalyzerExtraction(): AnalyzerExtractionResult {
  return {
    companyProfile: {
      companyName: buildSourcedString("Test Corp"),
      summary: buildSourcedString("A test company."),
      businessModel: buildSourcedString("SES and consulting"),
      marketPosition: buildSourcedString("Mid-market player"),
      industryTrends: buildSourcedString("Growing AI adoption"),
      strengths: [
        { value: "Strong team", sourceRef: buildSourceRef([2]) },
      ],
      keyRisks: [
        { value: "High concentration", sourceRef: buildSourceRef([3]) },
      ],
      location: buildSourcedString("Tokyo"),
      industry: buildSourcedString("IT Services"),
      askingPrice: buildSourcedString("500000000"),
    },
    financialHighlights: {
      revenue: buildSourcedString("250000000", [4]),
      ebitda: buildSourcedString("50000000", [4]),
      currency: buildSourcedString("JPY", [4]),
      revenueGrowth: buildSourcedString("CAGR 12%", [5]),
      operatingMargin: buildSourcedString("15%", [5]),
      ebitdaMargin: buildSourcedString("20%", [5]),
      recurringRevenue: buildSourcedString("40%"),
      employeeCount: buildSourcedNumber(100, [6]),
      fullTimeCount: buildSourcedNumber(80, [6]),
      contractorCount: buildSourcedNumber(20, [6]),
      topClientConcentration: buildSourcedString("25%", [7]),
      debtLevel: buildSourcedString("0.5x D/E", [8]),
    },
    managementTeam: [
      {
        name: "Taro Yamada",
        title: "CEO",
        department: null,
        role: "executive",
        reportsTo: null,
        sourceRef: buildSourceRef([9], "Taro Yamada, CEO"),
      },
    ],
    rawObservations: {
      clientInfo: buildSourcedString("Top client is 25%", [7]),
      debtInfo: buildSourcedString("Low leverage", [8]),
      technologyInfo: buildSourcedString("Mixed stack"),
      orgStructureInfo: buildSourcedString("Single entity"),
      aiDigitalInfo: buildSourcedString("Exploring AI"),
      serviceModelInfo: buildSourcedString("60% SES, 40% consulting"),
      integrationInfo: buildSourcedString("Founder staying 3 years"),
      legalComplianceInfo: buildSourcedString("No issues"),
      laborPracticesInfo: buildSourcedString("Standard"),
    },
  };
}

describe("analyzerExtractionSchema", () => {
  it("validates correct extraction data with source refs", () => {
    const result = analyzerExtractionSchema.safeParse(buildValidAnalyzerExtraction());
    expect(result.success).toBe(true);
  });

  it("allows null values with source refs", () => {
    const data = buildValidAnalyzerExtraction();
    data.financialHighlights.revenue = buildSourcedString(null);
    data.financialHighlights.ebitda = buildSourcedString(null);
    const result = analyzerExtractionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("analyzerScoringSchema", () => {
  it("validates correct scoring data", () => {
    const dim = {
      score: 4,
      rationale: "Good performance",
      evidence: "Revenue growing at 12%",
      dataAvailable: true,
    };
    const result = analyzerScoringSchema.safeParse({
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
      redFlags: [{ flagId: "mod_cli_top_30_40", notes: "Top client at 25%" }],
      infoGaps: [{ flagId: "gap_fin_no_audit", notes: "No audit" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("flattenSourcedExtraction", () => {
  it("strips source refs and produces flat values", () => {
    const extraction = buildValidAnalyzerExtraction();
    const flat = flattenSourcedExtraction(extraction);

    expect(flat.companyProfile.companyName).toBe("Test Corp");
    expect(flat.companyProfile.summary).toBe("A test company.");
    expect(flat.companyProfile.strengths).toEqual(["Strong team"]);
    expect(flat.companyProfile.keyRisks).toEqual(["High concentration"]);
    expect(flat.financialHighlights.revenue).toBe("250000000");
    expect(flat.financialHighlights.employeeCount).toBe(100);
    expect(flat.managementTeam[0].name).toBe("Taro Yamada");
    expect(flat.managementTeam[0].role).toBe("executive");
  });

  it("handles null values", () => {
    const extraction = buildValidAnalyzerExtraction();
    extraction.financialHighlights.revenue = buildSourcedString(null);
    const flat = flattenSourcedExtraction(extraction);
    expect(flat.financialHighlights.revenue).toBeNull();
  });
});

describe("collectSourceRefs", () => {
  it("collects source refs from all fields", () => {
    const extraction = buildValidAnalyzerExtraction();
    const refs = collectSourceRefs(extraction);

    expect(refs["companyProfile.companyName"]).toBeDefined();
    expect(refs["companyProfile.companyName"].type).toBe("im_document");
    expect(refs["financialHighlights.revenue"]).toBeDefined();
    expect(refs["financialHighlights.revenue"].pageNumbers).toEqual([4]);
    expect(refs["managementTeam[0]"]).toBeDefined();
    expect(refs["companyProfile.strengths[0]"]).toBeDefined();
  });
});
