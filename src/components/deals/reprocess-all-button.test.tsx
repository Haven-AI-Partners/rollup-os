/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: (props: any) => <button {...props} />,
  AlertDialogCancel: (props: any) => <button {...props} />,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: any) => <span {...props} />,
  RefreshCw: (props: any) => <span {...props} />,
  CheckCircle: (props: any) => <span {...props} />,
  XCircle: (props: any) => <span {...props} />,
}));

vi.mock("@/lib/actions/im-processing", () => ({
  reprocessAllIMFiles: vi.fn(),
}));

vi.mock("@/hooks/use-run-status", () => ({
  useRunStatus: () => ({
    state: "idle",
    output: null,
    error: null,
  }),
}));

import { ReprocessAllButton } from "./reprocess-all-button";

describe("ReprocessAllButton", () => {
  it("renders reprocess all button", () => {
    render(<ReprocessAllButton portcoSlug="test-portco" />);
    expect(screen.getByText("Reprocess All IMs")).toBeInTheDocument();
  });

  it("renders alert dialog content", () => {
    render(<ReprocessAllButton portcoSlug="test-portco" />);
    expect(screen.getByText("Reprocess all IM files?")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Reprocess All")).toBeInTheDocument();
  });
});
