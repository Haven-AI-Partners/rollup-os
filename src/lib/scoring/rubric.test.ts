import { describe, it, expect } from "vitest";
import {
  SCORING_DIMENSIONS,
  RECOMMENDATION_BANDS,
  SCORE_LABELS,
  computeDimensionScore,
  calculateWeightedScore,
} from "./rubric";

describe("SCORING_DIMENSIONS", () => {
  it("has exactly 8 dimensions", () => {
    expect(SCORING_DIMENSIONS).toHaveLength(8);
  });

  it("weights sum to 1.0", () => {
    const total = SCORING_DIMENSIONS.reduce((sum, d) => sum + d.weight, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  it("each dimension has unique id", () => {
    const ids = SCORING_DIMENSIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each dimension has criteria for scores 1-5", () => {
    for (const dim of SCORING_DIMENSIONS) {
      const scores = dim.criteria.map((c) => c.score).sort();
      expect(scores).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("each dimension has at least one sub-criterion", () => {
    for (const dim of SCORING_DIMENSIONS) {
      expect(dim.subCriteria.length).toBeGreaterThan(0);
    }
  });

  it("each dimension has at least one red flag", () => {
    for (const dim of SCORING_DIMENSIONS) {
      expect(dim.redFlags.length).toBeGreaterThan(0);
    }
  });

  it("default scores are between 1 and 5", () => {
    for (const dim of SCORING_DIMENSIONS) {
      expect(dim.defaultScore).toBeGreaterThanOrEqual(1);
      expect(dim.defaultScore).toBeLessThanOrEqual(5);
    }
  });
});

describe("SCORE_LABELS", () => {
  it("covers all scores 1-5", () => {
    expect(Object.keys(SCORE_LABELS).map(Number).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("RECOMMENDATION_BANDS", () => {
  it("covers the full 0-5 range without gaps", () => {
    expect(RECOMMENDATION_BANDS[RECOMMENDATION_BANDS.length - 1].min).toBe(0);
    expect(RECOMMENDATION_BANDS[0].max).toBe(5.0);
  });

  it("bands are in descending order", () => {
    for (let i = 1; i < RECOMMENDATION_BANDS.length; i++) {
      expect(RECOMMENDATION_BANDS[i].max).toBeLessThan(RECOMMENDATION_BANDS[i - 1].min);
    }
  });

  it("each band has a label and description", () => {
    for (const band of RECOMMENDATION_BANDS) {
      expect(band.label).toBeTruthy();
      expect(band.description).toBeTruthy();
    }
  });
});

describe("computeDimensionScore", () => {
  it("computes average of sub-scores", () => {
    const result = computeDimensionScore("financial_stability", [
      { id: "revenue_growth", score: 5 },
      { id: "operating_margin", score: 3 },
      { id: "cash_flow", score: 4 },
      { id: "recurring_revenue", score: 4 },
    ]);
    expect(result).toBe(4);
  });

  it("uses default score for null sub-scores", () => {
    const result = computeDimensionScore("financial_stability", [
      { id: "revenue_growth", score: 5 },
      { id: "operating_margin", score: null },
      { id: "cash_flow", score: null },
      { id: "recurring_revenue", score: null },
    ]);
    // revenue_growth=5, others default to 3 → (5+3+3+3)/4 = 3.5
    expect(result).toBe(3.5);
  });

  it("returns dimension default for empty sub-scores", () => {
    const result = computeDimensionScore("financial_stability", []);
    expect(result).toBe(3); // financial_stability defaultScore
  });

  it("returns 3 for unknown dimension", () => {
    const result = computeDimensionScore("nonexistent", [{ id: "x", score: 5 }]);
    expect(result).toBe(3);
  });

  it("rounds to 1 decimal place", () => {
    const result = computeDimensionScore("financial_stability", [
      { id: "revenue_growth", score: 5 },
      { id: "operating_margin", score: 4 },
      { id: "cash_flow", score: 3 },
    ]);
    expect(result).toBe(4);
  });
});

describe("calculateWeightedScore", () => {
  it("returns weighted score with recommendation", () => {
    const scores: Record<string, number> = {};
    for (const dim of SCORING_DIMENSIONS) {
      scores[dim.id] = 4.5;
    }
    const result = calculateWeightedScore(scores);
    expect(result.weighted).toBe(4.5);
    expect(result.recommendation).toBe("Strong Candidate");
  });

  it("handles partial scores (missing some dimensions)", () => {
    const result = calculateWeightedScore({ financial_stability: 5 });
    expect(result.weighted).toBe(5);
    expect(result.recommendation).toBe("Strong Candidate");
  });

  it("returns 0 for empty scores", () => {
    const result = calculateWeightedScore({});
    expect(result.weighted).toBe(0);
  });

  it("returns correct band for marginal score", () => {
    const scores: Record<string, number> = {};
    for (const dim of SCORING_DIMENSIONS) {
      scores[dim.id] = 2.7;
    }
    const result = calculateWeightedScore(scores);
    expect(result.recommendation).toBe("Marginal");
  });

  it("returns correct band for high risk score", () => {
    const scores: Record<string, number> = {};
    for (const dim of SCORING_DIMENSIONS) {
      scores[dim.id] = 1.5;
    }
    const result = calculateWeightedScore(scores);
    expect(result.recommendation).toBe("High Risk");
  });
});
