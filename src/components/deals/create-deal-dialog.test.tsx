/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("opens dialog on trigger click", () => {
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    fireEvent.click(screen.getByRole("button", { name: /add deal/i }));

    expect(screen.getByText("Create New Deal")).toBeInTheDocument();
    expect(screen.getByLabelText("Company Name *")).toBeInTheDocument();
  });

  it("submits form with correct data", async () => {
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    fireEvent.click(screen.getByRole("button", { name: /add deal/i }));
    fireEvent.change(screen.getByLabelText("Company Name *"), { target: { value: "New Corp" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "A great company" } });
    fireEvent.change(screen.getByLabelText("Industry"), { target: { value: "IT Services" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Tokyo" } });
    fireEvent.click(screen.getByRole("button", { name: /create deal/i }));

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

    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    fireEvent.click(screen.getByRole("button", { name: /add deal/i }));
    fireEvent.change(screen.getByLabelText("Company Name *"), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /create deal/i }));

    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();

    await act(async () => { resolveSubmit!(); });
  });

  it("closes dialog on cancel", async () => {
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    fireEvent.click(screen.getByRole("button", { name: /add deal/i }));
    expect(screen.getByText("Create New Deal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText("Create New Deal")).not.toBeInTheDocument();
    });
  });

  it("renders stage options in pipeline stage select", () => {
    render(<CreateDealDialog portcoId="p1" portcoSlug="test" stages={stages} />);

    fireEvent.click(screen.getByRole("button", { name: /add deal/i }));

    // The first stage should be the default value shown
    expect(screen.getAllByText("Screening").length).toBeGreaterThanOrEqual(1);
  });
});
