/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { TaskList } from "./task-list";

vi.mock("@/lib/actions/tasks", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{props.children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

vi.mock("@/lib/constants", () => ({
  TASK_STATUS_ICONS: {},
}));

vi.mock("lucide-react", () => ({
  Circle: () => <svg data-testid="circle-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
}));

function buildTask(overrides: Partial<{
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: Date | null;
}> = {}) {
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Review financials",
    description: overrides.description ?? null,
    category: overrides.category ?? "evaluation",
    status: overrides.status ?? "todo",
    priority: overrides.priority ?? "medium",
    dueDate: overrides.dueDate ?? null,
    completedAt: overrides.completedAt ?? null,
  };
}

describe("TaskList", () => {
  const baseProps = {
    dealId: "deal-1",
    portcoId: "portco-1",
    portcoSlug: "test-portco",
  };

  it("renders task items", () => {
    const tasks = [
      buildTask({ id: "t1", title: "Review financials" }),
      buildTask({ id: "t2", title: "Check legal docs" }),
    ];
    render(<TaskList {...baseProps} initialTasks={tasks} />);
    expect(screen.getByText("Review financials")).toBeInTheDocument();
    expect(screen.getByText("Check legal docs")).toBeInTheDocument();
  });

  it("renders empty state when no tasks", () => {
    render(<TaskList {...baseProps} initialTasks={[]} />);
    expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
  });
});
