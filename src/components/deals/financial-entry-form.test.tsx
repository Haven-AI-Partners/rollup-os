/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FinancialEntryForm } from "./financial-entry-form";

vi.mock("@/lib/actions/financials", () => ({
  addFinancialEntry: vi.fn().mockResolvedValue(undefined),
}));

const defaultProps = {
  dealId: "deal-1",
  portcoId: "portco-1",
  portcoSlug: "test-portco",
};

describe("FinancialEntryForm", () => {
  it("renders the add button when form is closed", () => {
    render(<FinancialEntryForm {...defaultProps} />);
    expect(screen.getByText("Add Financial Period")).toBeInTheDocument();
  });

  it("shows form fields when add button is clicked", async () => {
    const user = userEvent.setup();
    render(<FinancialEntryForm {...defaultProps} />);

    await user.click(screen.getByText("Add Financial Period"));

    expect(screen.getByText("New Financial Period")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Period (e.g. FY2024, Q3 2024)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Revenue")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("EBITDA")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Net Income")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("EBITDA Margin %")).toBeInTheDocument();
  });

  it("renders submit button when form is open", async () => {
    const user = userEvent.setup();
    render(<FinancialEntryForm {...defaultProps} />);

    await user.click(screen.getByText("Add Financial Period"));

    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});
