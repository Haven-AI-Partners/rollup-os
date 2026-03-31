/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { KanbanBoard } from "./kanban-board";

const mockMoveDealToStage = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/actions/deals", () => ({
  moveDealToStage: (...args: unknown[]) => mockMoveDealToStage(...args),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/format", () => ({
  formatCurrency: (val: string) => `¥${val}`,
}));

const stages = [
  { id: "s1", name: "Screening", color: "#3b82f6", phase: "sourcing", position: 0 },
  { id: "s2", name: "Due Diligence", color: "#f59e0b", phase: "evaluation", position: 1 },
  { id: "s3", name: "Closing", color: "#22c55e", phase: "closing", position: 2 },
];

function buildDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: "deal-1",
    stageId: "s1",
    companyName: "Acme Corp",
    description: "IT consulting",
    industry: "Technology",
    location: "Tokyo",
    askingPrice: "5000000",
    revenue: "1000000",
    ebitda: "200000",
    currency: "JPY",
    status: "active",
    source: "manual",
    kanbanPosition: 0,
    aiScore: "4.2",
    redFlagCount: 2,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("KanbanBoard", () => {
  it("renders all stage columns", () => {
    render(<KanbanBoard stages={stages} initialDeals={[]} portcoSlug="test" />);

    expect(screen.getByText("Screening")).toBeInTheDocument();
    expect(screen.getByText("Due Diligence")).toBeInTheDocument();
    expect(screen.getByText("Closing")).toBeInTheDocument();
  });

  it("renders deal cards in correct columns", () => {
    const deals = [
      buildDeal({ id: "d1", stageId: "s1", companyName: "Alpha Corp" }),
      buildDeal({ id: "d2", stageId: "s2", companyName: "Beta LLC" }),
    ];
    render(<KanbanBoard stages={stages} initialDeals={deals} portcoSlug="test" />);

    expect(screen.getByText("Alpha Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta LLC")).toBeInTheDocument();
  });

  it("shows deal count badges per column", () => {
    const deals = [
      buildDeal({ id: "d1", stageId: "s1" }),
      buildDeal({ id: "d2", stageId: "s1", companyName: "Beta" }),
      buildDeal({ id: "d3", stageId: "s2", companyName: "Gamma" }),
    ];
    render(<KanbanBoard stages={stages} initialDeals={deals} portcoSlug="test" />);

    // Column badges show deal count — "2" may also appear elsewhere (e.g., red flag counts)
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1); // s3 has 0 deals
  });

  it("sorts deals by AI score descending within columns", () => {
    const deals = [
      buildDeal({ id: "d1", stageId: "s1", companyName: "Low Score", aiScore: "2.0", kanbanPosition: 0 }),
      buildDeal({ id: "d2", stageId: "s1", companyName: "High Score", aiScore: "4.5", kanbanPosition: 1 }),
      buildDeal({ id: "d3", stageId: "s1", companyName: "Mid Score", aiScore: "3.0", kanbanPosition: 2 }),
    ];
    render(<KanbanBoard stages={stages} initialDeals={deals} portcoSlug="test" />);

    const cards = screen.getAllByText(/Score/);
    expect(cards[0].textContent).toContain("High Score");
    expect(cards[1].textContent).toContain("Mid Score");
    expect(cards[2].textContent).toContain("Low Score");
  });

  it("renders empty columns without errors", () => {
    render(<KanbanBoard stages={stages} initialDeals={[]} portcoSlug="test" />);

    // All columns should still render with 0 count
    const zeroBadges = screen.getAllByText("0");
    expect(zeroBadges.length).toBe(3);
  });

  it("renders deal card with AI score", () => {
    const deals = [buildDeal({ aiScore: "4.2" })];
    render(<KanbanBoard stages={stages} initialDeals={deals} portcoSlug="test" />);

    expect(screen.getByText("4.2/5")).toBeInTheDocument();
  });

  it("renders deal card with red flag count", () => {
    const deals = [buildDeal({ redFlagCount: 3 })];
    render(<KanbanBoard stages={stages} initialDeals={deals} portcoSlug="test" />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders deal links with correct href", () => {
    const deals = [buildDeal({ id: "d1" })];
    render(<KanbanBoard stages={stages} initialDeals={deals} portcoSlug="my-portco" />);

    const link = screen.getByText("Acme Corp").closest("a");
    expect(link).toHaveAttribute("href", "/my-portco/pipeline/d1/overview");
  });

  it("handles deals with no AI score", () => {
    const deals = [buildDeal({ aiScore: null, redFlagCount: 0, revenue: null, ebitda: null })];
    render(<KanbanBoard stages={stages} initialDeals={deals} portcoSlug="test" />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });
});
