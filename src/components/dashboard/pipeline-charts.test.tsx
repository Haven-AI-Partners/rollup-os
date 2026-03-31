/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("recharts", () => ({
  Bar: (props: any) => <div data-testid="bar" {...props} />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  CartesianGrid: () => <div />,
  Cell: (props: any) => <div data-testid="cell" {...props} />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: any) => <div>{children}</div>,
  ChartTooltipContent: () => <div />,
}));

import { PipelineCharts } from "./pipeline-charts";

const stages = [
  { id: "stage-1", name: "Sourced", color: "#3B82F6" },
  { id: "stage-2", name: "Screening", color: "#F59E0B" },
];

const monthlyData = [
  { month: "Jan", "stage-1": 3, "stage-2": 1 },
  { month: "Feb", "stage-1": 5, "stage-2": 2 },
];

const currentMonthData = [
  { stageName: "Sourced", stageColor: "#3B82F6", count: 5 },
  { stageName: "Screening", stageColor: "#F59E0B", count: 2 },
];

describe("PipelineCharts", () => {
  it("renders charts with data", () => {
    render(
      <PipelineCharts
        stages={stages}
        monthlyData={monthlyData}
        currentMonthData={currentMonthData}
        currentMonthLabel="March 2024"
      />
    );
    expect(screen.getByText("Deals by Month")).toBeInTheDocument();
    expect(screen.getByText("Current Month (March 2024)")).toBeInTheDocument();
  });

  it("shows empty states when no data", () => {
    render(
      <PipelineCharts
        stages={stages}
        monthlyData={[]}
        currentMonthData={[]}
        currentMonthLabel="March 2024"
      />
    );
    expect(screen.getByText("No deal data yet.")).toBeInTheDocument();
    expect(screen.getByText("No deals this month.")).toBeInTheDocument();
  });

  it("renders with monthly data present", () => {
    render(
      <PipelineCharts
        stages={stages}
        monthlyData={monthlyData}
        currentMonthData={currentMonthData}
        currentMonthLabel="March 2024"
      />
    );
    expect(
      screen.getByText("Pipeline deals added per month, by current stage")
    ).toBeInTheDocument();
  });
});
