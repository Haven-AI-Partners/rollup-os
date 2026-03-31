/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: any) => <span data-testid="loader" {...props} />,
  FolderSearch: (props: any) => <span data-testid="folder-search" {...props} />,
  CheckCircle: (props: any) => <span data-testid="check" {...props} />,
  XCircle: (props: any) => <span data-testid="xcircle" {...props} />,
}));

const mockScanGdriveFolder = vi.fn();
vi.mock("@/lib/actions/im-processing", () => ({
  scanGdriveFolder: (...args: any[]) => mockScanGdriveFolder(...args),
}));

vi.mock("@/hooks/use-run-status", () => ({
  useRunStatus: () => ({
    state: "idle",
    output: null,
    error: null,
  }),
}));

import { ScanFolderButton } from "./scan-folder-button";

describe("ScanFolderButton", () => {
  it("renders scan button", () => {
    render(<ScanFolderButton portcoSlug="test-portco" />);
    expect(screen.getByText("Scan Folder & Process IMs")).toBeInTheDocument();
  });

  it("handles click", async () => {
    mockScanGdriveFolder.mockResolvedValue({ runId: "run-1" });
    render(<ScanFolderButton portcoSlug="test-portco" />);
    await act(async () => {
      fireEvent.click(screen.getByText("Scan Folder & Process IMs"));
    });
    expect(mockScanGdriveFolder).toHaveBeenCalledWith("test-portco");
  });
});
