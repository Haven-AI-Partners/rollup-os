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
  Brain: (props: any) => <span data-testid="brain" {...props} />,
  CheckCircle: (props: any) => <span data-testid="check" {...props} />,
  XCircle: (props: any) => <span data-testid="xcircle" {...props} />,
}));

const mockProcessIMFile = vi.fn();
vi.mock("@/lib/actions/im-processing", () => ({
  processIMFile: (...args: any[]) => mockProcessIMFile(...args),
}));

vi.mock("@/hooks/use-run-status", () => ({
  useRunStatus: () => ({
    state: "idle",
    output: null,
    error: null,
  }),
}));

import { ProcessIMButton } from "./process-im-button";

describe("ProcessIMButton", () => {
  const defaultProps = {
    portcoSlug: "test-portco",
    fileId: "file-1",
    processingStatus: "pending",
  };

  it("renders process button for pending status", () => {
    render(<ProcessIMButton {...defaultProps} />);
    expect(screen.getByText("Process IM")).toBeInTheDocument();
  });

  it("renders completed state with reprocess button", () => {
    render(
      <ProcessIMButton {...defaultProps} processingStatus="completed" />
    );
    expect(screen.getByText("Processed")).toBeInTheDocument();
    expect(screen.getByText("Reprocess")).toBeInTheDocument();
  });

  it("handles process button click", async () => {
    mockProcessIMFile.mockResolvedValue({ runId: "run-1" });
    render(<ProcessIMButton {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Process IM"));
    });
    expect(mockProcessIMFile).toHaveBeenCalledWith("test-portco", "file-1");
  });
});
