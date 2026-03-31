/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

import { FileTypeBadge } from "./file-type-badge";

describe("FileTypeBadge", () => {
  it("renders simple badge without tooltip", () => {
    render(
      <FileTypeBadge
        label="PDF"
        classificationConfidence={null}
        classifiedBy={null}
      />
    );
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
  });

  it("renders badge with tooltip for auto classification", () => {
    render(
      <FileTypeBadge
        label="IM"
        classificationConfidence="0.95"
        classifiedBy="auto"
      />
    );
    expect(screen.getByText("IM")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Confidence score: 95%")).toBeInTheDocument();
  });

  it("renders simple badge for manual classification", () => {
    render(
      <FileTypeBadge
        label="CIM"
        classificationConfidence="0.8"
        classifiedBy="manual"
      />
    );
    expect(screen.getByText("CIM")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
  });

  it("accepts custom className", () => {
    render(
      <FileTypeBadge
        label="PDF"
        className="custom-class"
        classificationConfidence={null}
        classifiedBy={null}
      />
    );
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });
});
