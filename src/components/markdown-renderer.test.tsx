/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/mermaid-diagram", () => ({
  MermaidDiagram: ({ chart, className }: { chart: string; className?: string }) => (
    <div data-testid="mermaid-diagram" data-chart={chart} className={className}>
      Mermaid: {chart}
    </div>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(" "),
}));

import { MarkdownRenderer } from "./markdown-renderer";

describe("MarkdownRenderer", () => {
  it("renders plain markdown text", () => {
    render(<MarkdownRenderer content="# Hello World" />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders markdown tables", () => {
    const table = "| A | B |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<MarkdownRenderer content={table} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("renders mermaid code blocks as MermaidDiagram", () => {
    const content = "Some text\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nMore text";
    render(<MarkdownRenderer content={content} />);

    const diagram = screen.getByTestId("mermaid-diagram");
    expect(diagram).toBeInTheDocument();
    expect(diagram.getAttribute("data-chart")).toBe("graph TD\n  A-->B");
  });

  it("renders non-mermaid code blocks normally", () => {
    const content = "```javascript\nconsole.log('hello');\n```";
    const { container } = render(<MarkdownRenderer content={content} />);

    // Should have a pre element (not a mermaid diagram)
    expect(container.querySelector("pre")).toBeInTheDocument();
    expect(screen.queryByTestId("mermaid-diagram")).not.toBeInTheDocument();
  });

  it("wraps tables when wrapTables is true", () => {
    const table = "| A | B |\n|---|---|\n| 1 | 2 |";
    const { container } = render(
      <MarkdownRenderer content={table} wrapTables />,
    );

    const wrapper = container.querySelector(".overflow-x-auto");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.querySelector("table")).toBeInTheDocument();
  });

  it("fixes malformed alignment rows", () => {
    // Header has 3 cols but alignment row has 2
    const table = "| A | B | C |\n|---|---|\n| 1 | 2 | 3 |";
    const { container } = render(<MarkdownRenderer content={table} />);

    // Should still render a valid table
    const tableEl = container.querySelector("table");
    expect(tableEl).toBeInTheDocument();
  });

  it("handles multiple mermaid blocks in one document", () => {
    const content = [
      "# Doc",
      "",
      "```mermaid",
      "graph TD",
      "  A-->B",
      "```",
      "",
      "Some text",
      "",
      "```mermaid",
      "graph LR",
      "  C-->D",
      "```",
    ].join("\n");

    render(<MarkdownRenderer content={content} />);

    const diagrams = screen.getAllByTestId("mermaid-diagram");
    expect(diagrams).toHaveLength(2);
    expect(diagrams[0].getAttribute("data-chart")).toBe("graph TD\n  A-->B");
    expect(diagrams[1].getAttribute("data-chart")).toBe("graph LR\n  C-->D");
  });
});
