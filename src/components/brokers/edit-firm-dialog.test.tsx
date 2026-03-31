/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditFirmDialog } from "./edit-firm-dialog";

const mockUpdateBrokerFirm = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/actions/brokers", () => ({
  updateBrokerFirm: (...args: unknown[]) => mockUpdateBrokerFirm(...args),
}));

const firm = {
  id: "firm-1",
  name: "TRANBI",
  website: "https://tranbi.com",
  region: "Japan",
  specialty: "IT Services",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditFirmDialog", () => {
  it("renders edit trigger button", () => {
    render(<EditFirmDialog firm={firm} portcoSlug="test-portco" />);
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("pre-fills form with existing firm data", async () => {
    render(<EditFirmDialog firm={firm} portcoSlug="test-portco" />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByLabelText("Firm Name *")).toHaveValue("TRANBI");
    expect(screen.getByLabelText("Website")).toHaveValue("https://tranbi.com");
    expect(screen.getByLabelText("Region")).toHaveValue("Japan");
    expect(screen.getByLabelText("Specialty")).toHaveValue("IT Services");
  });

  it("submits updated values", async () => {
    render(<EditFirmDialog firm={firm} portcoSlug="test-portco" />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const nameInput = screen.getByLabelText("Firm Name *");
    fireEvent.change(nameInput, { target: { value: "Updated Firm" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateBrokerFirm).toHaveBeenCalledWith("firm-1", "test-portco", {
        name: "Updated Firm",
        website: "https://tranbi.com",
        region: "Japan",
        specialty: "IT Services",
      });
    });
  });

  it("disables submit when name is cleared", async () => {
    render(<EditFirmDialog firm={firm} portcoSlug="test-portco" />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const nameInput = screen.getByLabelText("Firm Name *");
    fireEvent.change(nameInput, { target: { value: "" } });

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("handles null optional fields", async () => {
    const nullFirm = { id: "firm-2", name: "Simple Firm", website: null, region: null, specialty: null };
    render(<EditFirmDialog firm={nullFirm} portcoSlug="test-portco" />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByLabelText("Firm Name *")).toHaveValue("Simple Firm");
    expect(screen.getByLabelText("Website")).toHaveValue("");
    expect(screen.getByLabelText("Region")).toHaveValue("");
    expect(screen.getByLabelText("Specialty")).toHaveValue("");
  });
});
