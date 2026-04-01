/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { DealTabs } from "./deal-tabs";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/test-portco/deals/deal-1/overview"),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("DealTabs", () => {
  it("renders all tab labels", () => {
    render(<DealTabs basePath="/test-portco/deals/deal-1" />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Thesis")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("Financials")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
  });

  it("renders tabs as links with correct hrefs", () => {
    render(<DealTabs basePath="/test-portco/deals/deal-1" />);

    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink).toHaveAttribute("href", "/test-portco/deals/deal-1/overview");
  });
});
