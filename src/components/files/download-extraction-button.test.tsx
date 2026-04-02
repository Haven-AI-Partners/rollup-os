/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock("lucide-react", () => ({
  Download: (props: any) => <span data-testid="download-icon" {...props} />,
  Loader2: (props: any) => <span data-testid="loader-icon" {...props} />,
}));

const mockGetFileExtraction = vi.fn();
vi.mock("@/lib/actions/file-extractions", () => ({
  getFileExtraction: (...args: any[]) => mockGetFileExtraction(...args),
}));

vi.mock("@/lib/extraction-download", () => ({
  extractionToDownloadable: vi.fn(() => ({
    filename: "report.md",
    content: "# Test content",
    mimeType: "text/markdown",
  })),
}));

import { DownloadExtractionButton } from "./download-extraction-button";

// Save original before any spying
const originalCreateElement = document.createElement;

describe("DownloadExtractionButton", () => {
  const defaultProps = { fileId: "file-1", fileName: "report.pdf" };
  let anchorClickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock");
    global.URL.revokeObjectURL = vi.fn();

    anchorClickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag: string, options?: any) => {
      const el = originalCreateElement.call(document, tag, options);
      if (tag === "a") {
        el.click = anchorClickSpy as unknown as () => void;
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders download button with icon", () => {
    render(<DownloadExtractionButton {...defaultProps} />);
    expect(screen.getByTitle("Download as markdown")).toBeInTheDocument();
    expect(screen.getByTestId("download-icon")).toBeInTheDocument();
  });

  it("fetches extraction and triggers download on click", async () => {
    const extraction = {
      contentExtraction: { pages: [{ pageNumber: 1, content: "# Hello" }] },
      translation: null,
    };
    mockGetFileExtraction.mockResolvedValue(extraction);

    render(<DownloadExtractionButton {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("Download as markdown"));
    });

    expect(mockGetFileExtraction).toHaveBeenCalledWith("file-1");
    expect(anchorClickSpy).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("does not trigger download when extraction is null", async () => {
    mockGetFileExtraction.mockResolvedValue(null);

    render(<DownloadExtractionButton {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("Download as markdown"));
    });

    expect(mockGetFileExtraction).toHaveBeenCalledWith("file-1");
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("shows loader while fetching", async () => {
    let resolve: (v: any) => void;
    const pending = new Promise((r) => { resolve = r; });
    mockGetFileExtraction.mockReturnValue(pending);

    render(<DownloadExtractionButton {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("Download as markdown"));
    });

    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    await act(async () => {
      resolve!(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("download-icon")).toBeInTheDocument();
    });
  });
});
