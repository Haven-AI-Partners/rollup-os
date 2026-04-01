/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { CommentList } from "./comment-list";

vi.mock("@/lib/actions/deals", () => ({
  addComment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: vi.fn().mockReturnValue("Jan 1, 2025"),
}));

const defaultProps = {
  dealId: "deal-1",
  portcoId: "portco-1",
  portcoSlug: "test-portco",
};

describe("CommentList", () => {
  it("renders comments", () => {
    const comments = [
      { id: "c1", content: "First comment", userId: "user-1", createdAt: new Date("2025-01-01") },
      { id: "c2", content: "Second comment", userId: "user-2", createdAt: new Date("2025-01-02") },
    ];
    render(<CommentList {...defaultProps} initialComments={comments} />);

    expect(screen.getByText("First comment")).toBeInTheDocument();
    expect(screen.getByText("Second comment")).toBeInTheDocument();
  });

  it("renders empty state when no comments", () => {
    render(<CommentList {...defaultProps} initialComments={[]} />);
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });

  it("renders the comment form", () => {
    render(<CommentList {...defaultProps} initialComments={[]} />);
    expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument();
    expect(screen.getByText("Comment")).toBeInTheDocument();
  });
});
