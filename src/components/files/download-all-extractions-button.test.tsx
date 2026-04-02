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
  FolderDown: (props: any) => <span data-testid="folder-icon" {...props} />,
  Loader2: (props: any) => <span data-testid="loader-icon" {...props} />,
}));

import { DownloadAllExtractionsButton } from "./download-all-extractions-button";

// Save original before any spying
const originalCreateElement = document.createElement;

describe("DownloadAllExtractionsButton", () => {
  const defaultProps = { dealId: "deal-1", dealName: "Acme Corp", count: 3 };
  let anchorClickSpy: ReturnType<typeof vi.fn>;
  let capturedDownload: string;

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock");
    global.URL.revokeObjectURL = vi.fn();
    capturedDownload = "";
    anchorClickSpy = vi.fn();

    vi.spyOn(document, "createElement").mockImplementation((tag: string, options?: any) => {
      const el = originalCreateElement.call(document, tag, options);
      if (tag === "a") {
        el.click = anchorClickSpy as unknown as () => void;
        Object.defineProperty(el, "download", {
          set(v: string) { capturedDownload = v; },
          get() { return capturedDownload; },
        });
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders button with count", () => {
    render(<DownloadAllExtractionsButton {...defaultProps} />);
    expect(screen.getByText("Download All (3)")).toBeInTheDocument();
    expect(screen.getByTestId("folder-icon")).toBeInTheDocument();
  });

  it("fetches zip and triggers download on click", async () => {
    const mockBlob = new Blob(["zip-content"], { type: "application/zip" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    render(<DownloadAllExtractionsButton {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Download All (3)"));
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/deals/deal-1/extractions/download");
    expect(anchorClickSpy).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("does not trigger download when response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    render(<DownloadAllExtractionsButton {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Download All (3)"));
    });

    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("shows loader while fetching", async () => {
    let resolve: (v: any) => void;
    const pending = new Promise((r) => { resolve = r; });
    global.fetch = vi.fn().mockReturnValue(pending);

    render(<DownloadAllExtractionsButton {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Download All (3)"));
    });

    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    await act(async () => {
      resolve!({ ok: false });
    });

    await waitFor(() => {
      expect(screen.getByTestId("folder-icon")).toBeInTheDocument();
    });
  });

  it("sanitizes deal name for the zip filename", async () => {
    const mockBlob = new Blob(["zip"], { type: "application/zip" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    render(
      <DownloadAllExtractionsButton
        dealId="deal-1"
        dealName="Acme <Corp> & Co."
        count={2}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Download All (2)"));
    });

    expect(capturedDownload).toBe("Acme Corp  Co-extractions.zip");
  });
});
