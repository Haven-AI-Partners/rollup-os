/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PasswordGate } from "./password-gate";

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{props.children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("lucide-react", () => ({
  Lock: () => <svg data-testid="lock-icon" />,
  AlertCircle: () => <svg />,
}));

describe("PasswordGate", () => {
  const baseProps = {
    sessionId: "session-1",
    employeeName: "Tanaka",
    companyName: "Acme Corp",
    onAuthenticated: vi.fn(),
  };

  it("renders password form", () => {
    render(<PasswordGate {...baseProps} />);
    expect(screen.getByText("業務ヒアリング")).toBeInTheDocument();
    expect(screen.getByText("パスワード")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("メールに記載されたパスワードを入力")).toBeInTheDocument();
  });

  it("renders employee name greeting", () => {
    render(<PasswordGate {...baseProps} />);
    expect(screen.getByText(/Tanakaさん、こんにちは/)).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<PasswordGate {...baseProps} />);
    expect(screen.getByText("ヒアリングを開始")).toBeInTheDocument();
  });
});
