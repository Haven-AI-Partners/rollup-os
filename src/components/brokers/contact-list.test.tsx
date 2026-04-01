/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { ContactList } from "./contact-list";

vi.mock("@/lib/actions/brokers", () => ({
  createBrokerContact: vi.fn().mockResolvedValue(undefined),
  deleteBrokerContact: vi.fn().mockResolvedValue(undefined),
}));

const defaultProps = {
  firmId: "firm-1",
  portcoSlug: "test-portco",
};

describe("ContactList", () => {
  it("renders contacts", () => {
    const contacts = [
      { id: "c1", fullName: "John Doe", email: "john@example.com", phone: "555-1234", title: "Managing Director" },
      { id: "c2", fullName: "Jane Smith", email: null, phone: null, title: null },
    ];
    render(<ContactList {...defaultProps} initialContacts={contacts} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Managing Director")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("555-1234")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders contact count badge", () => {
    const contacts = [
      { id: "c1", fullName: "John Doe", email: null, phone: null, title: null },
    ];
    render(<ContactList {...defaultProps} initialContacts={contacts} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders empty state with add button", () => {
    render(<ContactList {...defaultProps} initialContacts={[]} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Add Contact")).toBeInTheDocument();
  });

  it("renders the Contacts heading", () => {
    render(<ContactList {...defaultProps} initialContacts={[]} />);
    expect(screen.getByText("Contacts")).toBeInTheDocument();
  });
});
