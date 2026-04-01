/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { KanbanColumn } from "./kanban-column";

vi.mock("@dnd-kit/core", () => ({
  useDroppable: vi.fn().mockReturnValue({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: {},
}));

vi.mock("./deal-card", () => ({
  DealCard: ({ deal }: { deal: { companyName: string } }) => (
    <div data-testid="deal-card">{deal.companyName}</div>
  ),
}));

const stage = {
  id: "stage-1",
  name: "Initial Review",
  color: "#3b82f6",
  phase: "screening",
};

const deals = [
  {
    id: "deal-1",
    companyName: "Acme Corp",
    description: null,
    industry: "Tech",
    location: null,
    askingPrice: null,
    revenue: null,
    ebitda: null,
    currency: null,
    status: "active",
    source: null,
    aiScore: null,
    redFlagCount: 0,
  },
];

describe("KanbanColumn", () => {
  it("renders stage name and deal count", () => {
    render(
      <KanbanColumn
        stage={stage}
        deals={deals}
        portcoSlug="test-portco"
        selectedIds={new Set()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Initial Review")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders deal cards", () => {
    render(
      <KanbanColumn
        stage={stage}
        deals={deals}
        portcoSlug="test-portco"
        selectedIds={new Set()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders empty column", () => {
    render(
      <KanbanColumn
        stage={stage}
        deals={[]}
        portcoSlug="test-portco"
        selectedIds={new Set()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Initial Review")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
