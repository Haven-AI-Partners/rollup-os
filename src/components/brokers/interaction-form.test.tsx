/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InteractionForm } from "./interaction-form";

const mockCreateInteraction = vi.fn().mockResolvedValue(undefined);
const mockOnClose = vi.fn();

vi.mock("@/lib/actions/brokers", () => ({
  createInteraction: (...args: unknown[]) => mockCreateInteraction(...args),
}));

vi.mock("@/lib/constants", () => ({
  INTERACTION_TYPES: ["email_sent", "email_received", "call", "meeting"] as const,
  INTERACTION_TYPE_LABELS: {
    email_sent: "Email Sent",
    email_received: "Email Received",
    call: "Call",
    meeting: "Meeting",
  } as Record<string, string>,
}));

const contacts = [
  { id: "c1", fullName: "Tanaka Taro" },
  { id: "c2", fullName: "Suzuki Hanako" },
];

const defaultProps = {
  firmId: "firm-1",
  portcoId: "portco-1",
  portcoSlug: "test-portco",
  contacts,
  onClose: mockOnClose,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InteractionForm", () => {
  it("renders contact and type selects", () => {
    render(<InteractionForm {...defaultProps} />);

    expect(screen.getByText("Contact *")).toBeInTheDocument();
    expect(screen.getByText("Type *")).toBeInTheDocument();
  });

  it("submit button is disabled when no contact selected", () => {
    render(<InteractionForm {...defaultProps} />);
    expect(screen.getByRole("button", { name: /log interaction/i })).toBeDisabled();
  });

  it("calls onClose on cancel", async () => {
    render(<InteractionForm {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("renders subject and notes inputs", () => {
    render(<InteractionForm {...defaultProps} />);

    expect(screen.getByPlaceholderText("Subject")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Notes...")).toBeInTheDocument();
  });

  it("renders date/time input", () => {
    render(<InteractionForm {...defaultProps} />);
    expect(screen.getByText("Date/Time")).toBeInTheDocument();
  });
});
