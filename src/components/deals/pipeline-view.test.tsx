/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PipelineView } from "./pipeline-view";

vi.mock("./kanban-board", () => ({
  KanbanBoard: () => <div data-testid="kanban-board">Kanban Board</div>,
}));

vi.mock("./deal-list-view", () => ({
  DealListView: ({ stages }: { stages: { name: string }[] }) => (
    <div data-testid="deal-list-view">
      {stages.map((s) => (
        <span key={s.name}>{s.name}</span>
      ))}
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  LayoutGrid: () => <svg data-testid="grid-icon" />,
  List: () => <svg data-testid="list-icon" />,
}));

const stages = [
  { id: "s1", name: "Screening", phase: "sourcing", position: 0, color: "#3b82f6", portcoId: "p1" },
  { id: "s2", name: "Due Diligence", phase: "evaluation", position: 1, color: "#f59e0b", portcoId: "p1" },
];

const deals: Parameters<typeof PipelineView>[0]["deals"] = [];

describe("PipelineView", () => {
  it("renders pipeline stages in list view by default", () => {
    render(<PipelineView stages={stages} deals={deals} portcoSlug="test" />);
    expect(screen.getByTestId("deal-list-view")).toBeInTheDocument();
    expect(screen.getByText("Screening")).toBeInTheDocument();
    expect(screen.getByText("Due Diligence")).toBeInTheDocument();
  });

  it("shows Board and List toggle buttons", () => {
    render(<PipelineView stages={stages} deals={deals} portcoSlug="test" />);
    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
  });
});
