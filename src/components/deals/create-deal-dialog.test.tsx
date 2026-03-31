/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateDealDialog } from "./create-deal-dialog";

const mockCreateDeal = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/actions/deals", () => ({
  createDeal: (...args: unknown[]) => mockCreateDeal(...args),
}));

const stages = [
  { id: "s1", name: "Screening" },
  { id: "s2", name: "Due Diligence" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateDealDialog", () => {
  it("renders 'Add Deal' trigger button", () => {
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);
    expect(screen.getByRole("button", { name: /add deal/i })).toBeInTheDocument();
  });

  it("opens dialog on trigger click", async () => {
    const user = userEvent.setup();
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    await user.click(screen.getByRole("button", { name: /add deal/i }));

    expect(screen.getByText("Create New Deal")).toBeInTheDocument();
    expect(screen.getByLabelText("Company Name *")).toBeInTheDocument();
  });

  it("submits form with correct data", async () => {
    const user = userEvent.setup();
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    await user.click(screen.getByRole("button", { name: /add deal/i }));
    await user.type(screen.getByLabelText("Company Name *"), "New Corp");
    await user.type(screen.getByLabelText("Description"), "A great company");
    await user.type(screen.getByLabelText("Industry"), "IT Services");
    await user.type(screen.getByLabelText("Location"), "Tokyo");
    await user.click(screen.getByRole("button", { name: /create deal/i }));

    await waitFor(() => {
      expect(mockCreateDeal).toHaveBeenCalledWith("p1", "test", expect.objectContaining({
        companyName: "New Corp",
        description: "A great company",
        industry: "IT Services",
        location: "Tokyo",
      }));
    });
  });

  it("shows loading state during submission", async () => {
    let resolveSubmit: () => void;
    mockCreateDeal.mockImplementation(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );

    const user = userEvent.setup();
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    await user.click(screen.getByRole("button", { name: /add deal/i }));
    await user.type(screen.getByLabelText("Company Name *"), "Test");
    await user.click(screen.getByRole("button", { name: /create deal/i }));

    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();

    await act(async () => { resolveSubmit!(); });
  });

  it("closes dialog on cancel", async () => {
    const user = userEvent.setup();
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    await user.click(screen.getByRole("button", { name: /add deal/i }));
    expect(screen.getByText("Create New Deal")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText("Create New Deal")).not.toBeInTheDocument();
    });
  });

  it("renders stage options in pipeline stage select", async () => {
    const user = userEvent.setup();
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    await user.click(screen.getByRole("button", { name: /add deal/i }));

    // The first stage should be the default value shown
    expect(screen.getAllByText("Screening").length).toBeGreaterThanOrEqual(1);
  });
});
