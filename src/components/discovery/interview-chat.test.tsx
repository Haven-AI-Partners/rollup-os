/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { InterviewChat } from "./interview-chat";

// Mock fetch globally to prevent actual API calls
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  body: {
    getReader: () => ({
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    }),
  },
});
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{props.children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Send: () => <svg />,
  Pause: () => <svg />,
  Loader2: () => <svg />,
  Bot: () => <svg data-testid="bot-icon" />,
  User: () => <svg data-testid="user-icon" />,
}));

describe("InterviewChat", () => {
  const baseProps = {
    sessionId: "session-1",
    employeeName: "Tanaka",
  };

  it("renders chat interface with header", () => {
    render(<InterviewChat {...baseProps} />);
    expect(screen.getByText(/Tanakaさん/)).toBeInTheDocument();
  });

  it("renders message input", () => {
    render(<InterviewChat {...baseProps} />);
    const input = screen.getByPlaceholderText("メッセージを入力...");
    expect(input).toBeInTheDocument();
  });

  it("renders pause button", () => {
    render(<InterviewChat {...baseProps} />);
    expect(screen.getByText("一時停止")).toBeInTheDocument();
  });
});
