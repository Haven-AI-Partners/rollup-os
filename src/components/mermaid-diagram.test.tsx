/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockRender = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ svg: '<svg data-testid="mermaid-svg">diagram</svg>' }),
);
const mockInitialize = vi.hoisted(() => vi.fn());

vi.mock("mermaid", () => ({
  default: {
    initialize: mockInitialize,
    render: mockRender,
  },
}));

import { MermaidDiagram } from "./mermaid-diagram";

describe("MermaidDiagram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    // Delay the render to keep it in loading state
    mockRender.mockReturnValue(new Promise(() => {}));

    render(<MermaidDiagram chart="graph TD\n  A-->B" />);
    expect(screen.getByText("Rendering diagram...")).toBeInTheDocument();
  });

  it("renders mermaid SVG on success", async () => {
    mockRender.mockResolvedValue({ svg: '<svg class="mermaid-output">test</svg>' });

    const { container } = render(<MermaidDiagram chart="graph TD\n  A-->B" />);

    await waitFor(() => {
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    expect(mockInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
      }),
    );
  });

  it("shows raw code on render failure", async () => {
    mockRender.mockRejectedValue(new Error("Parse error"));

    render(<MermaidDiagram chart="invalid mermaid syntax" />);

    await waitFor(() => {
      expect(screen.getByText("invalid mermaid syntax")).toBeInTheDocument();
    });

    // Should show as code block fallback
    const codeEl = screen.getByText("invalid mermaid syntax");
    expect(codeEl.tagName).toBe("CODE");
  });

  it("applies className prop", async () => {
    mockRender.mockResolvedValue({ svg: '<svg>ok</svg>' });

    const { container } = render(
      <MermaidDiagram chart="graph TD\n  A-->B" className="custom-class" />,
    );

    await waitFor(() => {
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    // The wrapper div should have the custom class
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
  });

  it("passes chart text to mermaid.render", async () => {
    mockRender.mockResolvedValue({ svg: '<svg>ok</svg>' });
    const chart = "graph TD\n  A-->B";

    render(<MermaidDiagram chart={chart} />);

    await waitFor(() => {
      expect(mockRender).toHaveBeenCalledTimes(1);
      expect(mockRender.mock.calls[0][1]).toBe(chart);
    });
  });
});
