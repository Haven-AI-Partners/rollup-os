/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { InteractionLog } from "./interaction-log";

vi.mock("@/lib/actions/brokers", () => ({
  createInteraction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/constants", () => ({
  INTERACTION_TYPE_ICONS: {},
  INTERACTION_TYPE_LABELS: {
    email_sent: "Email Sent",
    call: "Call",
  },
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: vi.fn().mockReturnValue("Jan 1, 2025"),
}));

vi.mock("./interaction-form", () => ({
  InteractionForm: () => <div data-testid="interaction-form">Form</div>,
}));

const defaultProps = {
  firmId: "firm-1",
  portcoId: "portco-1",
  portcoSlug: "test-portco",
  contacts: [{ id: "c1", fullName: "John Doe" }],
};

describe("InteractionLog", () => {
  it("renders the interaction log heading", () => {
    render(<InteractionLog {...defaultProps} initialInteractions={[]} />);
    expect(screen.getByText("Interaction Log")).toBeInTheDocument();
  });

  it("renders empty state when no interactions", () => {
    render(<InteractionLog {...defaultProps} initialInteractions={[]} />);
    expect(screen.getByText("No interactions logged yet.")).toBeInTheDocument();
  });

  it("renders interactions", () => {
    const interactions = [
      {
        id: "i1",
        type: "email_sent",
        direction: "outbound",
        subject: "Follow up on deal",
        body: "Hi, wanted to follow up...",
        occurredAt: new Date("2025-01-01"),
        contactName: "John Doe",
        contactId: "c1",
      },
    ];
    render(<InteractionLog {...defaultProps} initialInteractions={interactions} />);

    expect(screen.getByText("Email Sent")).toBeInTheDocument();
    expect(screen.getByText("Follow up on deal")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders interaction count badge", () => {
    const interactions = [
      {
        id: "i1",
        type: "call",
        direction: null,
        subject: null,
        body: null,
        occurredAt: new Date("2025-01-01"),
        contactName: "John Doe",
        contactId: "c1",
      },
    ];
    render(<InteractionLog {...defaultProps} initialInteractions={interactions} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows disabled button when no contacts", () => {
    render(<InteractionLog {...defaultProps} contacts={[]} initialInteractions={[]} />);
    expect(screen.getByText("Add a contact first")).toBeInTheDocument();
  });
});
