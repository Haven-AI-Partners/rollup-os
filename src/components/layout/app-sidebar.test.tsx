/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { AppSidebar } from "./app-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/test-portco/pipeline",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("./portco-switcher", () => ({
  PortcoSwitcher: () => <div data-testid="portco-switcher">Switcher</div>,
}));

// Mock all the sidebar UI components to avoid context dependency
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <nav data-testid="sidebar">{children}</nav>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  SidebarHeader: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  SidebarFooter: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children, isActive, asChild, ...props }: { children: React.ReactNode; isActive?: boolean; asChild?: boolean }) => (
    <li data-active={isActive} {...props}>{children}</li>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const portcos = [
  { id: "p1", name: "Test PortCo", slug: "test-portco", industry: "IT Services" },
];

const defaultProps = {
  portcoSlug: "test-portco",
  portcos,
  currentPortco: portcos[0],
  userRole: "admin",
};

describe("AppSidebar", () => {
  it("renders navigation groups", () => {
    render(<AppSidebar {...defaultProps} />);

    expect(screen.getByText("Deal Flow")).toBeInTheDocument();
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
  });

  it("renders deal flow nav items", () => {
    render(<AppSidebar {...defaultProps} />);

    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Brokers")).toBeInTheDocument();
    // "Analytics" appears in both Deal Flow and Portfolio groups
    expect(screen.getAllByText("Analytics").length).toBe(2);
  });

  it("renders portfolio nav items", () => {
    render(<AppSidebar {...defaultProps} />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Companies")).toBeInTheDocument();
  });

  it("renders workspace nav items", () => {
    render(<AppSidebar {...defaultProps} />);

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("shows admin section for admin role", () => {
    render(<AppSidebar {...defaultProps} userRole="admin" />);
    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows admin section for owner role", () => {
    render(<AppSidebar {...defaultProps} userRole="owner" />);
    expect(screen.getByText("Administration")).toBeInTheDocument();
  });

  it("hides admin section for analyst role", () => {
    render(<AppSidebar {...defaultProps} userRole="analyst" />);
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("hides admin section for viewer role", () => {
    render(<AppSidebar {...defaultProps} userRole="viewer" />);
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
  });

  it("includes portcoSlug in navigation links", () => {
    render(<AppSidebar {...defaultProps} />);

    const pipelineLink = screen.getByText("Pipeline").closest("a");
    expect(pipelineLink).toHaveAttribute("href", "/test-portco/pipeline");

    const brokersLink = screen.getByText("Brokers").closest("a");
    expect(brokersLink).toHaveAttribute("href", "/test-portco/brokers");
  });

  it("renders PortcoSwitcher", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByTestId("portco-switcher")).toBeInTheDocument();
  });

  it("shows Rollup OS branding", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText("Rollup OS")).toBeInTheDocument();
  });

  it("shows industry in footer", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText("IT Services")).toBeInTheDocument();
  });

  it("shows fallback text when industry is null", () => {
    const noIndustryPortco = { ...portcos[0], industry: null };
    render(<AppSidebar {...defaultProps} currentPortco={noIndustryPortco} />);
    expect(screen.getByText("M&A Platform")).toBeInTheDocument();
  });
});
