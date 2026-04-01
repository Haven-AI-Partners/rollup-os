/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { DeleteDealButton } from "./delete-deal-button";

vi.mock("@/lib/actions/deals", () => ({
  deleteDeal: vi.fn().mockResolvedValue(undefined),
}));

const defaultProps = {
  dealId: "deal-1",
  portcoSlug: "test-portco",
  companyName: "Acme Corp",
};

describe("DeleteDealButton", () => {
  it("renders the delete button", () => {
    render(<DeleteDealButton {...defaultProps} />);
    // The trigger button has a Trash2 icon inside it
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });
});
