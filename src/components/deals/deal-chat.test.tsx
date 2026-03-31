/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock scrollTo since jsdom doesn't implement it
Element.prototype.scrollTo = vi.fn();

const mockSendMessage = vi.fn();
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [
      {
        id: "msg-1",
        role: "user" as const,
        parts: [{ type: "text", text: "Hello" }],
      },
      {
        id: "msg-2",
        role: "assistant" as const,
        parts: [
          { type: "text", text: "Hi there" },
          { type: "tool-invocation", toolName: "search" },
        ],
      },
    ],
    sendMessage: mockSendMessage,
    status: "ready",
  }),
}));

vi.mock("ai", () => ({
  DefaultChatTransport: vi.fn(),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div data-testid="sheet">{children}</div>,
  SheetContent: ({ children }: any) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  MessageCircle: (props: any) => <span data-testid="message-circle" {...props} />,
  Send: (props: any) => <span data-testid="send" {...props} />,
  Loader2: (props: any) => <span data-testid="loader" {...props} />,
  Globe: (props: any) => <span data-testid="globe" {...props} />,
}));

// Mock createPortal to render children directly
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (node: any) => node,
  };
});

import { DealChat } from "./deal-chat";

// jsdom doesn't have scrollTo
Element.prototype.scrollTo = vi.fn();

describe("DealChat", () => {
  it("renders chat interface with messages", () => {
    render(<DealChat dealId="deal-123" />);
    expect(screen.getByText("DD Research Assistant")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
    expect(screen.getByText("Searched the web")).toBeInTheDocument();
  });

  it("renders the input form", () => {
    render(<DealChat dealId="deal-123" />);
    const input = screen.getByPlaceholderText("Ask about this deal...");
    expect(input).toBeInTheDocument();
  });

  it("handles form submission", () => {
    render(<DealChat dealId="deal-123" />);
    const input = screen.getByPlaceholderText("Ask about this deal...");
    fireEvent.change(input, { target: { value: "test question" } });
    const form = input.closest("form")!;
    fireEvent.submit(form);
    expect(mockSendMessage).toHaveBeenCalledWith({ text: "test question" });
  });

  it("does not submit empty input", () => {
    mockSendMessage.mockClear();
    render(<DealChat dealId="deal-123" />);
    const input = screen.getByPlaceholderText("Ask about this deal...");
    const form = input.closest("form")!;
    fireEvent.submit(form);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
