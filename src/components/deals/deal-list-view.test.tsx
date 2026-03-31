/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DealListView } from "./deal-list-view";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/format", () => ({
  formatCurrency: (val: string, cur: string | null) => `${cur ?? "JPY"} ${val}`,
  formatDateShort: () => "2024-01-01",
}));

vi.mock("./delete-deal-button", () => ({
  DeleteDealButton: ({ companyName }: { companyName: string }) => (
    <button data-testid={`delete-${companyName}`}>Delete</button>
  ),
}));

const stages = [
  { id: "s1", name: "Screening", phase: "sourcing", color: "#3b82f6" },
  { id: "s2", name: "Due Diligence", phase: "evaluation", color: "#f59e0b" },
];

function buildDeal(overrides: Partial<Parameters<typeof DealListView>[0]["deals"][0]> = {}) {
  return {
    id: "deal-1",
    companyName: "Acme Corp",
    description: "IT consulting firm",
    industry: "Technology",
    location: "Tokyo",
    askingPrice: "5000000",
    revenue: "1000000",
    ebitda: "200000",
    currency: "JPY",
    status: "active",
    source: "manual",
    stageId: "s1",
    aiScore: "4.2",
    redFlagCount: 2,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

const deals = [
  buildDeal(),
  buildDeal({ id: "deal-2", companyName: "Beta LLC", industry: "Healthcare", stageId: "s2", aiScore: "3.1", redFlagCount: 0, location: "Osaka" }),
  buildDeal({ id: "deal-3", companyName: "Gamma Inc", industry: null, description: null, location: null, aiScore: null, revenue: null, ebitda: null, redFlagCount: 0 }),
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DealListView", () => {
  it("renders all deals with company names", () => {
    render(<DealListView deals={deals} stages={stages} portcoSlug="test" />);

    // Each deal name appears twice (desktop table + mobile card)
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Beta LLC").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Gamma Inc").length).toBeGreaterThanOrEqual(1);
  });

  it("shows deal count", () => {
    render(<DealListView deals={deals} stages={stages} portcoSlug="test" />);
    expect(screen.getByText("3 deals")).toBeInTheDocument();
  });

  it("filters deals by search query across fields", async () => {
    render(<DealListView deals={deals} stages={stages} portcoSlug="test" />);

    fireEvent.change(screen.getByPlaceholderText("Search deals..."), { target: { value: "Healthcare" } });

    expect(screen.getAllByText("Beta LLC").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    expect(screen.getByText("1 deal")).toBeInTheDocument();
  });

  it("filters by location in search", async () => {
    render(<DealListView deals={deals} stages={stages} portcoSlug="test" />);

    fireEvent.change(screen.getByPlaceholderText("Search deals..."), { target: { value: "Osaka" } });

    expect(screen.getAllByText("Beta LLC").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("shows empty state when no deals match filters", async () => {
    render(<DealListView deals={deals} stages={stages} portcoSlug="test" />);

    fireEvent.change(screen.getByPlaceholderText("Search deals..."), { target: { value: "nonexistent" } });

    expect(screen.getAllByText("No deals match your filters.").length).toBeGreaterThan(0);
  });

  it("shows 'No deals yet' when deals array is empty", () => {
    render(<DealListView deals={[]} stages={stages} portcoSlug="test" />);
    expect(screen.getAllByText("No deals yet.").length).toBeGreaterThan(0);
  });

  it("displays AI score with one decimal place", () => {
    render(<DealListView deals={[buildDeal()]} stages={stages} portcoSlug="test" />);
    // Appears in both desktop and mobile
    expect(screen.getAllByText("4.2").length).toBeGreaterThanOrEqual(1);
  });

  it("displays '--' for missing AI score", () => {
    render(<DealListView deals={[buildDeal({ aiScore: null })]} stages={stages} portcoSlug="test" />);
    const dashes = screen.getAllByText("--");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("shows red flag count with icon", () => {
    render(<DealListView deals={[buildDeal({ redFlagCount: 3 })]} stages={stages} portcoSlug="test" />);
    // Red flag count appears in both desktop and mobile
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("shows delete button only for admin/owner roles", () => {
    const { rerender } = render(
      <DealListView deals={deals} stages={stages} portcoSlug="test" userRole="admin" />
    );
    expect(screen.getAllByTestId("delete-Acme Corp").length).toBeGreaterThanOrEqual(1);

    rerender(
      <DealListView deals={deals} stages={stages} portcoSlug="test" userRole="analyst" />
    );
    expect(screen.queryByTestId("delete-Acme Corp")).not.toBeInTheDocument();
  });

  it("shows delete button for owner role", () => {
    render(<DealListView deals={deals} stages={stages} portcoSlug="test" userRole="owner" />);
    expect(screen.getAllByTestId("delete-Acme Corp").length).toBeGreaterThanOrEqual(1);
  });

  it("hides delete button when no role", () => {
    render(<DealListView deals={deals} stages={stages} portcoSlug="test" />);
    expect(screen.queryByTestId("delete-Acme Corp")).not.toBeInTheDocument();
  });

  it("navigates to deal on row click", () => {
    render(<DealListView deals={[buildDeal()]} stages={stages} portcoSlug="my-portco" />);

    // Click the first instance (desktop table row)
    const dealElements = screen.getAllByText("Acme Corp");
    fireEvent.click(dealElements[0]);

    expect(mockPush).toHaveBeenCalledWith("/my-portco/pipeline/deal-1/overview");
  });

  it("formats currency values", () => {
    render(<DealListView deals={[buildDeal()]} stages={stages} portcoSlug="test" />);
    expect(screen.getAllByText("JPY 1000000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("JPY 200000").length).toBeGreaterThanOrEqual(1);
  });
});
