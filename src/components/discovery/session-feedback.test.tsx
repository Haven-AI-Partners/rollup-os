/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  CheckCircle: (props: any) => <span data-testid="check-circle" {...props} />,
  Star: (props: any) => <span data-testid="star" {...props} />,
}));

import { SessionFeedback } from "./session-feedback";

describe("SessionFeedback", () => {
  const defaultProps = {
    sessionId: "session-1",
    employeeName: "田中太郎",
  };

  it("renders the feedback form", () => {
    render(<SessionFeedback {...defaultProps} />);
    expect(
      screen.getByText("ヒアリングお疲れ様でした")
    ).toBeInTheDocument();
  });

  it("renders star buttons", () => {
    render(<SessionFeedback {...defaultProps} />);
    const stars = screen.getAllByTestId("star");
    expect(stars).toHaveLength(5);
  });

  it("renders feedback tags", () => {
    render(<SessionFeedback {...defaultProps} />);
    expect(screen.getByText("役に立った")).toBeInTheDocument();
    expect(screen.getByText("分かりにくかった")).toBeInTheDocument();
  });

  it("toggles tags on click", () => {
    render(<SessionFeedback {...defaultProps} />);
    const tag = screen.getByText("役に立った");
    fireEvent.click(tag);
    // Clicking again should toggle off
    fireEvent.click(tag);
    expect(tag).toBeInTheDocument();
  });

  it("handles star rating click", () => {
    render(<SessionFeedback {...defaultProps} />);
    const starButtons = screen.getAllByRole("button").filter((b) =>
      b.querySelector("[data-testid='star']")
    );
    fireEvent.click(starButtons[2]); // click 3rd star
    fireEvent.mouseEnter(starButtons[3]);
    fireEvent.mouseLeave(starButtons[3]);
    expect(starButtons[2]).toBeInTheDocument();
  });

  it("skip button shows submitted state", () => {
    render(<SessionFeedback {...defaultProps} />);
    const skipBtn = screen.getByText("スキップする");
    fireEvent.click(skipBtn);
    expect(screen.getByText("ありがとうございました！")).toBeInTheDocument();
    expect(
      screen.getByText(/田中太郎さん、お疲れ様でした。/)
    ).toBeInTheDocument();
  });

  it("handles submit with rating", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    render(<SessionFeedback {...defaultProps} />);

    // Set rating
    const starButtons = screen.getAllByRole("button").filter((b) =>
      b.querySelector("[data-testid='star']")
    );
    fireEvent.click(starButtons[4]); // 5 stars

    // Click submit
    const submitBtn = screen.getByText("フィードバックを送信");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("ありがとうございました！")).toBeInTheDocument();
    });
  });

  it("updates comment text", () => {
    render(<SessionFeedback {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("その他のご意見（任意）");
    fireEvent.change(textarea, { target: { value: "Great session" } });
    expect(textarea).toHaveValue("Great session");
  });
});
