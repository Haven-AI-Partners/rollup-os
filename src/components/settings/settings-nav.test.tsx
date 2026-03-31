/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { SettingsNav } from "./settings-nav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/test-portco/settings/integrations"),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("SettingsNav", () => {
  it("renders all navigation tabs", () => {
    render(<SettingsNav portcoSlug="test-portco" />);

    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("Customization")).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
  });

  it("renders tabs as links with correct hrefs", () => {
    render(<SettingsNav portcoSlug="test-portco" />);

    const integrationsLink = screen.getByText("Integrations").closest("a");
    expect(integrationsLink).toHaveAttribute("href", "/test-portco/settings/integrations");

    const teamLink = screen.getByText("Team").closest("a");
    expect(teamLink).toHaveAttribute("href", "/test-portco/settings/team");
  });
});
