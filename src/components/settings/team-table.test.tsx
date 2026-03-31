/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { TeamTable } from "./team-table";

vi.mock("@/lib/actions/team", () => ({
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: () => <img alt="avatar" />,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  UserMinus: () => <svg data-testid="user-minus-icon" />,
}));

vi.mock("@/lib/format", () => ({
  formatRelativeDate: () => "2 days ago",
  formatDateShort: () => "2024-01-01",
}));

vi.mock("@/lib/constants", () => ({
  USER_ROLE_LABELS: { owner: "Owner", admin: "Admin", analyst: "Analyst", viewer: "Viewer" },
  USER_ROLE_COLORS: { owner: "text-purple-600", admin: "text-blue-600", analyst: "text-green-600", viewer: "text-gray-600" },
}));

function buildMember(overrides: Partial<{
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  role: string;
  membershipId: string;
  joinedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "user-1",
    email: overrides.email ?? "alice@example.com",
    fullName: overrides.fullName ?? "Alice Smith",
    avatarUrl: overrides.avatarUrl ?? null,
    lastLoginAt: overrides.lastLoginAt ?? new Date("2024-06-01"),
    createdAt: overrides.createdAt ?? new Date("2024-01-01"),
    role: overrides.role ?? "analyst",
    membershipId: overrides.membershipId ?? "mem-1",
    joinedAt: overrides.joinedAt ?? new Date("2024-01-01"),
  };
}

describe("TeamTable", () => {
  const baseProps = {
    currentUserId: "user-current",
    currentUserRole: "owner" as const,
    portcoId: "portco-1",
    portcoSlug: "test-portco",
  };

  it("renders table with member rows", () => {
    const members = [
      buildMember({ id: "u1", fullName: "Alice Smith", email: "alice@example.com", membershipId: "m1" }),
      buildMember({ id: "u2", fullName: "Bob Jones", email: "bob@example.com", membershipId: "m2" }),
    ];
    render(<TeamTable members={members} {...baseProps} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
  });
});
