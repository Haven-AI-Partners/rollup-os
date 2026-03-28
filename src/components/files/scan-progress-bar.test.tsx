/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { ScanProgressBar } from "./scan-progress-bar";

vi.mock("@/lib/format", () => ({
  formatRelativeTime: () => "2h ago",
}));

function mockProgressResponse(data: {
  totalFolders: number;
  scannedFolders: number;
  cachedFiles: number;
  scanInProgress: boolean;
  lastCompleteScanAt: string | null;
}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ScanProgressBar", () => {
  it("renders nothing when no scan data exists", async () => {
    mockProgressResponse({
      totalFolders: 0,
      scannedFolders: 0,
      cachedFiles: 0,
      scanInProgress: false,
      lastCompleteScanAt: null,
    });

    const { container } = render(<ScanProgressBar portcoId="portco-1" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Should render nothing
    expect(container.textContent).toBe("");
  });

  it("shows progress during scan", async () => {
    mockProgressResponse({
      totalFolders: 120,
      scannedFolders: 45,
      cachedFiles: 1234,
      scanInProgress: true,
      lastCompleteScanAt: null,
    });

    render(<ScanProgressBar portcoId="portco-1" />);

    await waitFor(() => {
      expect(screen.getByText(/45\/120 folders/)).toBeInTheDocument();
    });

    expect(screen.getByText(/1,234 files found/)).toBeInTheDocument();
  });

  it("shows completion state with file count and last scan time", async () => {
    mockProgressResponse({
      totalFolders: 50,
      scannedFolders: 50,
      cachedFiles: 500,
      scanInProgress: false,
      lastCompleteScanAt: "2024-06-15T10:00:00.000Z",
    });

    render(<ScanProgressBar portcoId="portco-1" />);

    await waitFor(() => {
      expect(screen.getByText(/500 files/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Last scanned 2h ago/)).toBeInTheDocument();
  });

  it("includes portcoId in the fetch URL", async () => {
    mockProgressResponse({
      totalFolders: 10,
      scannedFolders: 10,
      cachedFiles: 100,
      scanInProgress: false,
      lastCompleteScanAt: null,
    });

    render(<ScanProgressBar portcoId="my-portco-123" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("portcoId=my-portco-123"),
      );
    });
  });

  it("shows progress bar with correct width percentage", async () => {
    mockProgressResponse({
      totalFolders: 100,
      scannedFolders: 50,
      cachedFiles: 500,
      scanInProgress: true,
      lastCompleteScanAt: null,
    });

    render(<ScanProgressBar portcoId="portco-1" />);

    await waitFor(() => {
      expect(screen.getByText(/50\/100 folders/)).toBeInTheDocument();
    });

    // The progress bar inner div should have 50% width
    const progressBar = document.querySelector('[style*="width: 50%"]');
    expect(progressBar).toBeInTheDocument();
  });
});
