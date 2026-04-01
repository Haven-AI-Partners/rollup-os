/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { IssuesPanel } from "./thesis-issues-panel";
import type { ThesisNode } from "./thesis-tree";

const makeNode = (overrides: Partial<ThesisNode> = {}): ThesisNode => ({
  id: "node-1",
  label: "Test Node",
  description: null,
  status: "unknown",
  value: null,
  source: null,
  sourceDetail: null,
  notes: null,
  templateNodeId: null,
  children: [],
  ...overrides,
});

describe("IssuesPanel", () => {
  it("renders nothing when no issues", () => {
    const roots = [makeNode({ status: "complete" })];
    const { container } = render(<IssuesPanel roots={roots} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders risks section", () => {
    const roots = [makeNode({ id: "r1", label: "Risk Item", status: "risk", value: "High impact" })];
    render(<IssuesPanel roots={roots} />);

    expect(screen.getByText("Risks (1)")).toBeInTheDocument();
    expect(screen.getByText("Risk Item")).toBeInTheDocument();
    expect(screen.getByText("High impact")).toBeInTheDocument();
  });

  it("renders partial section", () => {
    const roots = [makeNode({ id: "p1", label: "Partial Item", status: "partial", notes: "Needs review" })];
    render(<IssuesPanel roots={roots} />);

    expect(screen.getByText("Partial (1)")).toBeInTheDocument();
    expect(screen.getByText("Partial Item")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });

  it("renders unknown section", () => {
    const roots = [makeNode({ id: "u1", label: "Unknown Item", status: "unknown" })];
    render(<IssuesPanel roots={roots} />);

    expect(screen.getByText("Unknown (1)")).toBeInTheDocument();
    expect(screen.getByText("Unknown Item")).toBeInTheDocument();
  });
});
