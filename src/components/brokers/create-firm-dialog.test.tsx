/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateBrokerFirmDialog } from "./create-firm-dialog";

const mockCreateBrokerFirm = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/actions/brokers", () => ({
  createBrokerFirm: (...args: unknown[]) => mockCreateBrokerFirm(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateBrokerFirmDialog", () => {
  it("renders trigger button", () => {
    render(<CreateBrokerFirmDialog portcoSlug="test-portco" />);
    expect(screen.getByRole("button", { name: /add broker firm/i })).toBeInTheDocument();
  });

  it("opens dialog on button click", async () => {
    render(<CreateBrokerFirmDialog portcoSlug="test-portco" />);

    fireEvent.click(screen.getByRole("button", { name: /add broker firm/i }));

    expect(screen.getByRole("heading", { name: "Add Broker Firm" })).toBeInTheDocument();
    expect(screen.getByLabelText("Firm Name *")).toBeInTheDocument();
  });

  it("submit button is disabled when name is empty", async () => {
    render(<CreateBrokerFirmDialog portcoSlug="test-portco" />);

    fireEvent.click(screen.getByRole("button", { name: /add broker firm/i }));

    expect(screen.getByRole("button", { name: /create firm/i })).toBeDisabled();
  });

  it("submits with trimmed values and closes dialog", async () => {
    render(<CreateBrokerFirmDialog portcoSlug="test-portco" />);

    fireEvent.click(screen.getByRole("button", { name: /add broker firm/i }));
    fireEvent.change(screen.getByLabelText("Firm Name *"), { target: { value: " TRANBI " } });
    fireEvent.change(screen.getByLabelText("Website"), { target: { value: "https://tranbi.com" } });
    fireEvent.click(screen.getByRole("button", { name: /create firm/i }));

    await waitFor(() => {
      expect(mockCreateBrokerFirm).toHaveBeenCalledWith("test-portco", {
        name: "TRANBI",
        website: "https://tranbi.com",
        region: undefined,
        specialty: undefined,
      });
    });
  });

  it("shows loading state during submission", async () => {
    let resolveSubmit: () => void;
    mockCreateBrokerFirm.mockImplementation(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );

    render(<CreateBrokerFirmDialog portcoSlug="test-portco" />);

    fireEvent.click(screen.getByRole("button", { name: /add broker firm/i }));
    fireEvent.change(screen.getByLabelText("Firm Name *"), { target: { value: "Test Firm" } });
    fireEvent.click(screen.getByRole("button", { name: /create firm/i }));

    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();

    resolveSubmit!();
  });
});
