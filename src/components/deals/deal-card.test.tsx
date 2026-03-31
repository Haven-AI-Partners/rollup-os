/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { DealCard } from "./deal-card";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock("@/lib/format", () => ({
  formatCurrency: (val: string) => `$${val}`,
}));

vi.mock("lucide-react", () => ({
  GripVertical: () => <svg data-testid="grip-icon" />,
  Star: () => <svg data-testid="star-icon" />,
  AlertTriangle: () => <svg data-testid="alert-icon" />,
}));

function buildDeal(overrides: Partial<Parameters<typeof DealCard>[0]["deal"]> = {}) {
  return {
    id: "deal-1",
    companyName: "Acme Corp",
    description: "IT consulting firm",
    industry: "Technology",
    location: "Tokyo",
    askingPrice: "5000000",
    revenue: "1000000",
    ebitda: "200000",
    currency: "JPY",
    status: "active",
    source: "broker",
    aiScore: "4.2",
    redFlagCount: 2,
    ...overrides,
  };
}

describe("DealCard", () => {
  const baseProps = {
    portcoSlug: "test-portco",
    isSelected: false,
    onSelect: vi.fn(),
  };

  it("renders company name", () => {
    render(<DealCard deal={buildDeal()} {...baseProps} />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders status badge with industry", () => {
    render(<DealCard deal={buildDeal({ industry: "Healthcare" })} {...baseProps} />);
    expect(screen.getByText("Healthcare")).toBeInTheDocument();
  });

  it("renders location badge", () => {
    render(<DealCard deal={buildDeal({ location: "Osaka" })} {...baseProps} />);
    expect(screen.getByText("Osaka")).toBeInTheDocument();
  });
});
