/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>{children}</span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/lib/constants", () => ({
  FILE_TYPE_LABELS: { im_pdf: "IM", excel_data: "Excel Data" },
  MIME_TYPE_ICONS: {},
}));

vi.mock("@/lib/format", () => ({
  formatBytes: () => "1 KB",
  formatDateWithYear: () => "Jan 1, 2024",
}));

vi.mock("@/components/deals/process-gdrive-file-button", () => ({
  ProcessGdriveFileButton: () => <button data-testid="process-btn">Process</button>,
}));

vi.mock("@/components/files/translate-excel-button", () => ({
  TranslateExcelButton: () => <button data-testid="translate-btn">Translate</button>,
}));

vi.mock("@/components/files/spreadsheet-viewer", () => ({
  SpreadsheetViewer: () => <button data-testid="spreadsheet-viewer">View</button>,
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock("lucide-react", () => ({
  FileText: () => <span>FileTextIcon</span>,
  ExternalLink: () => <span>ExternalLinkIcon</span>,
  CheckCircle: () => <span>CheckIcon</span>,
}));

import { FileRowContent } from "./file-row";
import type { GDriveFile, ProcessedInfo } from "./virtual-files-list";

const baseFile: GDriveFile = {
  id: "gf-1",
  name: "test.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  size: "1024",
  modifiedTime: "2024-01-01T00:00:00Z",
  webViewLink: "https://drive.google.com/file/1",
  parentPath: "Root/Data",
};

describe("FileRowContent", () => {
  it("shows Translate button for unprocessed Excel files when admin", () => {
    render(
      <FileRowContent
        file={baseFile}
        processed={undefined}
        portcoSlug="test-co"
        isAdmin={true}
      />,
    );

    expect(screen.getByTestId("translate-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("process-btn")).not.toBeInTheDocument();
  });

  it("shows Translated badge and SpreadsheetViewer for completed Excel files", () => {
    const processed: ProcessedInfo = {
      fileId: "file-1",
      status: "completed",
      dealId: null,
      fileType: "excel_data",
      classificationConfidence: null,
      classifiedBy: null,
    };

    render(
      <FileRowContent
        file={baseFile}
        processed={processed}
        portcoSlug="test-co"
        isAdmin={true}
      />,
    );

    expect(screen.getByText(/Translated/)).toBeInTheDocument();
    expect(screen.getByTestId("spreadsheet-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("translate-btn")).toBeInTheDocument();
  });

  it("shows correct mime labels for different file types", () => {
    const mimeTests = [
      { mimeType: "application/vnd.google-apps.folder", label: "Folder" },
      { mimeType: "application/vnd.google-apps.presentation", label: "Slides" },
      { mimeType: "application/vnd.google-apps.document", label: "Doc" },
      { mimeType: "image/png", label: "Image" },
    ];
    for (const { mimeType, label } of mimeTests) {
      const { unmount } = render(
        <FileRowContent
          file={{ ...baseFile, mimeType }}
          processed={undefined}
          portcoSlug="test-co"
          isAdmin={false}
        />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("shows Sheets mime label for spreadsheet files", () => {
    render(
      <FileRowContent
        file={baseFile}
        processed={undefined}
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    expect(screen.getByText("Sheets")).toBeInTheDocument();
  });

  it("does not show Translate button when not admin", () => {
    render(
      <FileRowContent
        file={baseFile}
        processed={undefined}
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    expect(screen.queryByTestId("translate-btn")).not.toBeInTheDocument();
  });

  it("shows Process button for PDF files", () => {
    const pdfFile: GDriveFile = {
      ...baseFile,
      mimeType: "application/pdf",
      name: "test.pdf",
    };

    render(
      <FileRowContent
        file={pdfFile}
        processed={undefined}
        portcoSlug="test-co"
        isAdmin={true}
      />,
    );

    expect(screen.getByTestId("process-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("translate-btn")).not.toBeInTheDocument();
  });
});
