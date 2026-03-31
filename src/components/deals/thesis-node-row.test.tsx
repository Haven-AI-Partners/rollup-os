/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThesisNodeRow } from "./thesis-node-row";
import type { ThesisNode } from "./thesis-tree";

const mockUpdateThesisNode = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/actions/thesis", () => ({
  updateThesisNode: (...args: unknown[]) => mockUpdateThesisNode(...args),
}));

vi.mock("@/lib/constants", () => ({
  THESIS_STATUS_CONFIG: {
    unknown: { label: "Unknown", badgeClass: "bg-gray-100", border: "#d1d5db", bg: "#f9fafb" },
    partial: { label: "Partial", badgeClass: "bg-amber-100", border: "#fbbf24", bg: "#fffbeb" },
    complete: { label: "Complete", badgeClass: "bg-green-100", border: "#22c55e", bg: "#f0fdf4" },
    risk: { label: "Risk", badgeClass: "bg-red-100", border: "#ef4444", bg: "#fef2f2" },
  },
}));

function buildNode(overrides: Partial<ThesisNode> = {}): ThesisNode {
  return {
    id: "node-1",
    label: "Revenue Growth",
    description: "Annual revenue growth rate",
    status: "complete",
    value: "15% YoY",
    source: "im_extracted",
    sourceDetail: null,
    notes: null,
    templateNodeId: null,
    children: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ThesisNodeRow", () => {
  it("renders leaf node with label and status badge", () => {
    render(
      <ThesisNodeRow node={buildNode()} depth={0} portcoSlug="test" dealId="deal-1" />
    );

    expect(screen.getByText("Revenue Growth")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("shows value text for leaf nodes", () => {
    render(
      <ThesisNodeRow node={buildNode()} depth={0} portcoSlug="test" dealId="deal-1" />
    );
    expect(screen.getByText("15% YoY")).toBeInTheDocument();
  });

  it("shows source badge for IM-extracted nodes", () => {
    render(
      <ThesisNodeRow node={buildNode({ source: "im_extracted" })} depth={0} portcoSlug="test" dealId="deal-1" />
    );
    expect(screen.getByText("IM")).toBeInTheDocument();
  });

  it("shows source badge for AI-generated nodes", () => {
    render(
      <ThesisNodeRow node={buildNode({ source: "agent_generated" })} depth={0} portcoSlug="test" dealId="deal-1" />
    );
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("enters edit mode when leaf node is clicked", async () => {
    render(
      <ThesisNodeRow node={buildNode()} depth={0} portcoSlug="test" dealId="deal-1" />
    );

    fireEvent.click(screen.getByText("Revenue Growth"));

    expect(screen.getByPlaceholderText("Data point or finding...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Additional notes...")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls updateThesisNode on save", async () => {
    render(
      <ThesisNodeRow node={buildNode()} depth={0} portcoSlug="test" dealId="deal-1" />
    );

    fireEvent.click(screen.getByText("Revenue Growth"));
    const valueInput = screen.getByPlaceholderText("Data point or finding...");
    fireEvent.change(valueInput, { target: { value: "20% YoY" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockUpdateThesisNode).toHaveBeenCalledWith("node-1", "test", "deal-1", {
        status: "complete",
        value: "20% YoY",
        notes: null,
        source: "manual",
      });
    });
  });

  it("cancels edit without saving", async () => {
    render(
      <ThesisNodeRow node={buildNode()} depth={0} portcoSlug="test" dealId="deal-1" />
    );

    fireEvent.click(screen.getByText("Revenue Growth"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(mockUpdateThesisNode).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText("Data point or finding...")).not.toBeInTheDocument();
  });

  it("renders parent node with child count aggregation", () => {
    const children = [
      buildNode({ id: "c1", status: "complete" }),
      buildNode({ id: "c2", status: "partial", label: "Margins" }),
      buildNode({ id: "c3", status: "risk", label: "Cash Flow" }),
    ];
    const parent = buildNode({ id: "parent", label: "Financial", children, value: null });

    render(
      <ThesisNodeRow node={parent} depth={0} portcoSlug="test" dealId="deal-1" />
    );

    expect(screen.getByText("Financial")).toBeInTheDocument();
    // Parent should show count text "/3" (total of leaf children)
    expect(screen.getByText("/3")).toBeInTheDocument();
  });

  it("toggles expand/collapse on parent node click", async () => {
    const child = buildNode({ id: "c1", label: "Sub Item" });
    const parent = buildNode({ id: "parent", label: "Parent", children: [child], value: null });

    render(
      <ThesisNodeRow node={parent} depth={0} portcoSlug="test" dealId="deal-1" />
    );

    // Initially expanded at depth 0
    expect(screen.getByText("Sub Item")).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText("Parent"));
    expect(screen.queryByText("Sub Item")).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(screen.getByText("Parent"));
    expect(screen.getByText("Sub Item")).toBeInTheDocument();
  });

  it("auto-collapses nodes at depth >= 2", () => {
    const child = buildNode({ id: "c1", label: "Deep Child" });
    const parent = buildNode({ id: "parent", label: "Deep Parent", children: [child], value: null });

    render(
      <ThesisNodeRow node={parent} depth={2} portcoSlug="test" dealId="deal-1" />
    );

    expect(screen.queryByText("Deep Child")).not.toBeInTheDocument();
  });

  it("shows description when no value is set", () => {
    render(
      <ThesisNodeRow
        node={buildNode({ value: null, description: "Annual growth metric" })}
        depth={0}
        portcoSlug="test"
        dealId="deal-1"
      />
    );
    expect(screen.getByText("Annual growth metric")).toBeInTheDocument();
  });
});
