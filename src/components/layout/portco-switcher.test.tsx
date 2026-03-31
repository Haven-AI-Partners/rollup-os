/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PortcoSwitcher } from "./portco-switcher";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const portcos = [
  { id: "p1", name: "Alpha Corp", slug: "alpha-corp", industry: "IT" },
  { id: "p2", name: "Beta Inc", slug: "beta-inc", industry: "Healthcare" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PortcoSwitcher", () => {
  it("renders with current portco selected", () => {
    render(<PortcoSwitcher portcos={portcos} currentPortco={portcos[0]} />);
    expect(screen.getByText("Alpha Corp")).toBeInTheDocument();
  });

  it("renders a select trigger", () => {
    render(<PortcoSwitcher portcos={portcos} currentPortco={portcos[0]} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("displays the current portco name as selected value", () => {
    render(<PortcoSwitcher portcos={portcos} currentPortco={portcos[1]} />);
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });
});
