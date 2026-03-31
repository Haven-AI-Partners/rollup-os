/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: any) => <span data-testid="loader" {...props} />,
  Brain: (props: any) => <span data-testid="brain" {...props} />,
  CheckCircle: (props: any) => <span data-testid="check" {...props} />,
}));

const mockProcessSingleFile = vi.fn();
vi.mock("@/lib/actions/im-processing", () => ({
  processSingleFile: (...args: any[]) => mockProcessSingleFile(...args),
}));

vi.mock("@/hooks/use-run-status", () => ({
  useRunStatus: () => ({
    state: "idle",
    output: null,
    error: null,
  }),
}));

import { ProcessGdriveFileButton } from "./process-gdrive-file-button";

describe("ProcessGdriveFileButton", () => {
  const defaultProps = {
    portcoSlug: "test-portco",
    gdriveFileId: "gdrive-1",
    fileName: "test.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    webViewLink: "https://drive.google.com/file/1",
  };

  it("renders import & process button", () => {
    render(<ProcessGdriveFileButton {...defaultProps} />);
    expect(screen.getByText("Import & Process")).toBeInTheDocument();
  });

  it("renders import & reprocess button with force prop", () => {
    render(<ProcessGdriveFileButton {...defaultProps} force={true} />);
    expect(screen.getByText("Import & Reprocess")).toBeInTheDocument();
  });

  it("handles click", () => {
    mockProcessSingleFile.mockResolvedValue({ runId: "run-1" });
    render(<ProcessGdriveFileButton {...defaultProps} />);
    fireEvent.click(screen.getByText("Import & Process"));
    expect(mockProcessSingleFile).toHaveBeenCalled();
  });
});
