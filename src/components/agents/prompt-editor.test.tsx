/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PromptEditor } from "./prompt-editor";

vi.mock("@/lib/actions/prompt-versions", () => ({
  savePromptVersion: vi.fn(),
  activatePromptVersion: vi.fn(),
  resetToDefaultPrompt: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{props.children}</button>
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: () => "2024-01-01 12:00",
}));

vi.mock("lucide-react", () => ({
  Save: () => <svg />,
  RotateCcw: () => <svg />,
  History: () => <svg />,
  Eye: () => <svg />,
  Pencil: () => <svg />,
  Check: () => <svg />,
}));

describe("PromptEditor", () => {
  const baseProps = {
    portcoSlug: "test-portco",
    agentSlug: "im-analyzer",
    currentTemplate: "You are a helpful assistant.",
    defaultTemplate: "You are a helpful assistant.",
    renderedPrompt: "You are a helpful assistant.",
    versions: [],
    isAdmin: true,
  };

  it("renders editor component with title", () => {
    render(<PromptEditor {...baseProps} />);
    expect(screen.getByText("System Prompt")).toBeInTheDocument();
  });

  it("renders template text in textarea", () => {
    render(<PromptEditor {...baseProps} />);
    const textarea = screen.getByDisplayValue("You are a helpful assistant.");
    expect(textarea).toBeInTheDocument();
  });

  it("shows Default badge when using default template", () => {
    render(<PromptEditor {...baseProps} />);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("renders in embedded mode without card wrapper", () => {
    render(<PromptEditor {...baseProps} embedded />);
    expect(screen.getByText("Template")).toBeInTheDocument();
  });
});
