/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThesisTree } from "./thesis-tree";
import type { ThesisNode } from "./thesis-tree";

// Mock the dynamically imported ThesisGraph
vi.mock("next/dynamic", () => ({
  default: () => {
    const MockGraph = () => <div data-testid="thesis-graph">Graph View</div>;
    MockGraph.displayName = "ThesisGraph";
    return MockGraph;
  },
}));

vi.mock("./thesis-node-row", () => ({
  ThesisNodeRow: ({ node, depth }: { node: ThesisNode; depth: number }) => (
    <div data-testid={`node-${node.id}`} data-depth={depth}>
      {node.label}
    </div>
  ),
}));

vi.mock("./thesis-issues-panel", () => ({
  IssuesPanel: () => <div data-testid="issues-panel">Issues</div>,
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

const defaultProps = {
  portcoSlug: "test-portco",
  dealId: "deal-1",
  companyName: "Acme Corp",
  stats: { unknown: 2, partial: 3, complete: 10, risk: 1, total: 16 },
};

describe("ThesisTree", () => {
  it("renders stat counts", () => {
    render(<ThesisTree roots={[buildNode()]} {...defaultProps} />);

    expect(screen.getByText("10 complete")).toBeInTheDocument();
    expect(screen.getByText("3 partial")).toBeInTheDocument();
    expect(screen.getByText("1 risks")).toBeInTheDocument();
    expect(screen.getByText("2 unknown")).toBeInTheDocument();
  });

  it("shows completion percentage", () => {
    render(<ThesisTree roots={[buildNode()]} {...defaultProps} />);
    // (10 + 3) / 16 * 100 = 81.25 → 81%
    expect(screen.getByText("81% coverage")).toBeInTheDocument();
  });

  it("shows 0% coverage when total is 0", () => {
    render(
      <ThesisTree
        roots={[]}
        {...defaultProps}
        stats={{ unknown: 0, partial: 0, complete: 0, risk: 0, total: 0 }}
      />
    );
    expect(screen.getByText("0% coverage")).toBeInTheDocument();
  });

  it("defaults to graph view", () => {
    render(<ThesisTree roots={[buildNode()]} {...defaultProps} />);
    expect(screen.getByTestId("thesis-graph")).toBeInTheDocument();
    expect(screen.getByTestId("issues-panel")).toBeInTheDocument();
  });

  it("toggles to list view", async () => {
    render(<ThesisTree roots={[buildNode()]} {...defaultProps} />);

    fireEvent.click(screen.getByTitle("List view"));

    expect(screen.getByTestId("node-node-1")).toBeInTheDocument();
    expect(screen.queryByTestId("thesis-graph")).not.toBeInTheDocument();
  });

  it("toggles back to graph view", async () => {
    render(<ThesisTree roots={[buildNode()]} {...defaultProps} />);

    fireEvent.click(screen.getByTitle("List view"));
    fireEvent.click(screen.getByTitle("Graph view"));

    expect(screen.getByTestId("thesis-graph")).toBeInTheDocument();
  });

  it("shows download button only in graph view", async () => {
    render(<ThesisTree roots={[buildNode()]} {...defaultProps} />);

    expect(screen.getByTitle("Download as SVG")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("List view"));

    expect(screen.queryByTitle("Download as SVG")).not.toBeInTheDocument();
  });

  it("renders multiple root nodes in list view", async () => {
    const roots = [
      buildNode({ id: "n1", label: "Financial" }),
      buildNode({ id: "n2", label: "Operational" }),
    ];
    render(<ThesisTree roots={roots} {...defaultProps} />);

    fireEvent.click(screen.getByTitle("List view"));

    expect(screen.getByTestId("node-n1")).toBeInTheDocument();
    expect(screen.getByTestId("node-n2")).toBeInTheDocument();
  });
});
