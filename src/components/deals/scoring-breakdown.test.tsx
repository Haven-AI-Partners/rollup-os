/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { ScoringBreakdown } from "./scoring-breakdown";

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/lib/scoring/rubric", () => ({
  SCORING_DIMENSIONS: [
    { id: "revenue", name: "Revenue Quality", weight: 0.2 },
    { id: "profitability", name: "Profitability", weight: 0.15 },
  ],
  SCORE_LABELS: { 1: "Poor", 2: "Below Avg", 3: "Average", 4: "Good", 5: "Excellent" },
  calculateWeightedScore: (scores: Record<string, number>) => {
    const values = Object.values(scores);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return {
      weighted: avg,
      recommendation: avg >= 3.5 ? "Proceed" : "Pass",
      description: "Test description",
    };
  },
}));

describe("ScoringBreakdown", () => {
  it("renders score sections", () => {
    const scores = { revenue: 4.0, profitability: 3.5 };
    render(<ScoringBreakdown scores={scores} />);
    expect(screen.getByText("IM Scoring Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Revenue Quality")).toBeInTheDocument();
    expect(screen.getByText("Profitability")).toBeInTheDocument();
  });

  it("renders when no score data (empty scores)", () => {
    render(<ScoringBreakdown scores={{}} />);
    expect(screen.getByText("IM Scoring Breakdown")).toBeInTheDocument();
  });
});
