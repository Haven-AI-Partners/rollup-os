/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

import { AgentConfigCard } from "./agent-config-card";

describe("AgentConfigCard", () => {
  const items = [
    { label: "Model", value: "gpt-4o", mono: true },
    { label: "Temperature", value: "0.2" },
    { label: "Max Tokens", value: "4096", mono: true },
  ];

  it("renders configuration card with items", () => {
    render(<AgentConfigCard items={items} />);
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("Temperature")).toBeInTheDocument();
    expect(screen.getByText("0.2")).toBeInTheDocument();
  });

  it("renders default badges", () => {
    render(<AgentConfigCard items={items} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Pipeline Agent")).toBeInTheDocument();
  });

  it("renders custom badges", () => {
    render(
      <AgentConfigCard items={items} badges={<span>Custom Badge</span>} />
    );
    expect(screen.getByText("Custom Badge")).toBeInTheDocument();
  });
});
