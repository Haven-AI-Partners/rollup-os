/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { ThesisGraph } from "./thesis-graph";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes }: { nodes: { data: { label: string } }[] }) => (
    <div data-testid="react-flow">
      {nodes.map((n: { data: { label: string } }, i: number) => (
        <div key={i} data-testid="flow-node">
          {n.data.label}
        </div>
      ))}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Position: { Left: "left", Right: "right" },
  Handle: () => null,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/lib/constants", () => ({
  THESIS_STATUS_CONFIG: {
    unknown: { border: "#ccc", bg: "#fff", badgeClass: "", label: "Unknown" },
    partial: { border: "#ffa", bg: "#ffe", badgeClass: "", label: "Partial" },
    complete: { border: "#afa", bg: "#efe", badgeClass: "", label: "Complete" },
    risk: { border: "#faa", bg: "#fee", badgeClass: "", label: "Risk" },
  },
}));

vi.mock("@/lib/format", () => ({
  formatDateTimeFull: () => "2024-01-01 12:00",
}));

interface MockNode {
  id: string;
  label: string;
  description: string | null;
  status: "unknown" | "partial" | "complete" | "risk";
  value: string | null;
  source: string | null;
  sourceDetail: string | null;
  notes: string | null;
  templateNodeId: string | null;
  children: MockNode[];
}

function makeThesisNode(overrides: Partial<MockNode> = {}): MockNode {
  return {
    id: overrides.id ?? "node-1",
    label: overrides.label ?? "Test Node",
    description: overrides.description ?? null,
    status: overrides.status ?? "unknown",
    value: overrides.value ?? null,
    source: overrides.source ?? null,
    sourceDetail: overrides.sourceDetail ?? null,
    notes: overrides.notes ?? null,
    templateNodeId: overrides.templateNodeId ?? null,
    children: overrides.children ?? [],
  };
}

describe("ThesisGraph", () => {
  const downloadRef = { current: null };

  it("renders without crashing when given empty roots", () => {
    render(
      <ThesisGraph roots={[]} downloadRef={downloadRef} companyName="TestCo" />
    );
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("renders node labels when provided", () => {
    const roots = [
      makeThesisNode({
        id: "root",
        label: "Root Theme",
        children: [
          makeThesisNode({ id: "child-1", label: "Child One" }),
          makeThesisNode({ id: "child-2", label: "Child Two" }),
        ],
      }),
    ];
    render(
      <ThesisGraph roots={roots} downloadRef={downloadRef} companyName="TestCo" />
    );
    expect(screen.getByText("Root Theme")).toBeInTheDocument();
    expect(screen.getByText("Child One")).toBeInTheDocument();
    expect(screen.getByText("Child Two")).toBeInTheDocument();
  });
});
