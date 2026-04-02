/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockGetFileExtraction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/file-extractions", () => ({
  getFileExtraction: mockGetFileExtraction,
}));

vi.mock("@/components/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, title, ...props }: any) => (
    <button onClick={onClick} title={title} {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(" "),
}));

import { FileExtractionViewer } from "./file-extraction-viewer";

const extractionWithDiagrams = {
  contentExtraction: {
    pages: [
      { pageNumber: 1, content: "# Overview", hasDiagram: false },
      { pageNumber: 2, content: "[Chart: Revenue chart]", hasDiagram: true },
    ],
    metadata: { totalPages: 2, documentLanguage: "en", documentTitle: "Test IM" },
  },
  translation: null,
  diagramImages: [
    {
      pageNumber: 2,
      base64: "fakeBase64ImageData",
      mimeType: "image/png",
      description: "Revenue chart",
    },
  ],
};

describe("FileExtractionViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger button", () => {
    render(<FileExtractionViewer fileId="file-001" fileName="test.pdf" />);
    expect(screen.getByTitle("View extracted content")).toBeInTheDocument();
  });

  it("loads extraction data and shows diagram image on open", async () => {
    mockGetFileExtraction.mockResolvedValue(extractionWithDiagrams);
    const user = userEvent.setup();

    render(<FileExtractionViewer fileId="file-001" fileName="test.pdf" />);

    await act(async () => {
      await user.click(screen.getByTitle("View extracted content"));
    });

    // Should show dialog with content
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("test.pdf")).toBeInTheDocument();

    // Should show diagram image
    const img = screen.getByAltText("Revenue chart");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "data:image/png;base64,fakeBase64ImageData");

    // Should show the description
    expect(screen.getByText("Revenue chart")).toBeInTheDocument();
  });

  it("shows Diagrams toggle button when diagram images exist", async () => {
    mockGetFileExtraction.mockResolvedValue(extractionWithDiagrams);
    const user = userEvent.setup();

    render(<FileExtractionViewer fileId="file-001" fileName="test.pdf" />);

    await act(async () => {
      await user.click(screen.getByTitle("View extracted content"));
    });

    // The Diagrams button should be visible
    const diagramsButton = screen.getByText("Diagrams");
    expect(diagramsButton).toBeInTheDocument();
  });

  it("toggles diagram images off and on", async () => {
    mockGetFileExtraction.mockResolvedValue(extractionWithDiagrams);
    const user = userEvent.setup();

    render(<FileExtractionViewer fileId="file-001" fileName="test.pdf" />);

    await act(async () => {
      await user.click(screen.getByTitle("View extracted content"));
    });

    // Image should be visible initially
    expect(screen.getByAltText("Revenue chart")).toBeInTheDocument();

    // Click Diagrams button to hide
    await act(async () => {
      await user.click(screen.getByTitle("Hide page images for diagrams"));
    });

    // Image should be hidden
    expect(screen.queryByAltText("Revenue chart")).not.toBeInTheDocument();

    // Click again to show
    await act(async () => {
      await user.click(screen.getByTitle("Show page images for diagrams"));
    });

    expect(screen.getByAltText("Revenue chart")).toBeInTheDocument();
  });

  it("does not show Diagrams button when no diagram images", async () => {
    mockGetFileExtraction.mockResolvedValue({
      contentExtraction: {
        pages: [{ pageNumber: 1, content: "# Text only", hasDiagram: false }],
        metadata: { totalPages: 1, documentLanguage: "en", documentTitle: null },
      },
      translation: null,
      diagramImages: null,
    });
    const user = userEvent.setup();

    render(<FileExtractionViewer fileId="file-001" fileName="test.pdf" />);

    await act(async () => {
      await user.click(screen.getByTitle("View extracted content"));
    });

    expect(screen.queryByText("Diagrams")).not.toBeInTheDocument();
  });

  it("handles null diagramImages gracefully", async () => {
    mockGetFileExtraction.mockResolvedValue({
      contentExtraction: {
        pages: [{ pageNumber: 1, content: "# Page 1", hasDiagram: false }],
        metadata: { totalPages: 1, documentLanguage: "en", documentTitle: null },
      },
      translation: null,
      diagramImages: null,
    });
    const user = userEvent.setup();

    render(<FileExtractionViewer fileId="file-001" fileName="test.pdf" />);

    await act(async () => {
      await user.click(screen.getByTitle("View extracted content"));
    });

    // Should render without errors
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
  });
});
