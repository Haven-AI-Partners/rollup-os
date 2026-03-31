/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: any) => <span {...props} />,
  FolderOpen: (props: any) => <span {...props} />,
  FileText: (props: any) => <span {...props} />,
  Download: (props: any) => <span {...props} />,
  Brain: (props: any) => <span {...props} />,
}));

vi.mock("@/lib/actions/im-processing", () => ({
  importGdriveFile: vi.fn(),
}));

vi.mock("@/lib/format", () => ({
  formatDateShort: (d: string) => d,
}));

import { ImportGdriveDialog } from "./import-gdrive-dialog";

describe("ImportGdriveDialog", () => {
  const defaultProps = {
    portcoSlug: "test-portco",
    dealId: "deal-1",
    portcoId: "portco-1",
  };

  it("renders dialog trigger button", () => {
    render(<ImportGdriveDialog {...defaultProps} />);
    expect(screen.getByText("Import from GDrive")).toBeInTheDocument();
  });

  it("renders dialog content", () => {
    render(<ImportGdriveDialog {...defaultProps} />);
    expect(screen.getByText("Import from Google Drive")).toBeInTheDocument();
    expect(
      screen.getByText("Select a file to import and optionally process with AI.")
    ).toBeInTheDocument();
  });

  it("shows no files message when empty", () => {
    render(<ImportGdriveDialog {...defaultProps} />);
    expect(
      screen.getByText("No files found in Google Drive folder.")
    ).toBeInTheDocument();
  });
});
