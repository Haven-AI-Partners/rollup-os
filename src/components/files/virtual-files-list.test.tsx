/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { VirtualFilesList, type GDriveFile, type ProcessedInfo } from "./virtual-files-list";

// Mock ProcessGdriveFileButton since it has server action dependencies
vi.mock("@/components/deals/process-gdrive-file-button", () => ({
  ProcessGdriveFileButton: () => <button>Import &amp; Process</button>,
}));

// Mock the virtualizer to render all items directly (jsdom has no layout engine)
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 64,
        size: 64,
        key: i,
      })),
    getTotalSize: () => count * 64,
    measureElement: () => {},
  }),
}));

function makeFile(overrides: Partial<GDriveFile> = {}): GDriveFile {
  return {
    id: "file-1",
    name: "Test File.pdf",
    mimeType: "application/pdf",
    size: "1024",
    modifiedTime: "2024-06-15T10:00:00Z",
    webViewLink: "https://drive.google.com/file/1",
    parentPath: "IMs/Subfolder",
    ...overrides,
  };
}

function makeInitialData(
  files: GDriveFile[] = [makeFile()],
  processedMap: Record<string, ProcessedInfo> = {},
  nextCursor: number | null = null,
) {
  return {
    files,
    processedMap,
    nextCursor,
    total: files.length + (nextCursor !== null ? 50 : 0),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VirtualFilesList", () => {
  it("renders file name and metadata", () => {
    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
        initialData={makeInitialData()}
      />,
    );

    expect(screen.getByText("Test File.pdf")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("IMs/Subfolder")).toBeInTheDocument();
  });

  it("shows file count summary", () => {
    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
        initialData={makeInitialData([makeFile()], {}, null)}
      />,
    );

    expect(screen.getByText("Showing 1 of 1 files")).toBeInTheDocument();
  });

  it("shows total including unloaded when more pages exist", () => {
    const data = makeInitialData([makeFile()], {}, 50);
    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
        initialData={data}
      />,
    );

    expect(screen.getByText("Showing 1 of 51 files")).toBeInTheDocument();
  });

  it("shows processed badge for completed files", () => {
    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
        initialData={makeInitialData(
          [makeFile()],
          { "file-1": { status: "completed", dealId: "deal-1" } },
        )}
      />,
    );

    expect(screen.getByText("Processed")).toBeInTheDocument();
  });

  it("shows process button for admins on PDF files", () => {
    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={true}
        initialData={makeInitialData([makeFile({ mimeType: "application/pdf" })])}
      />,
    );

    expect(screen.getByText("Import & Process")).toBeInTheDocument();
  });

  it("hides process button for non-admins", () => {
    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
        initialData={makeInitialData([makeFile({ mimeType: "application/pdf" })])}
      />,
    );

    expect(screen.queryByText("Import & Process")).not.toBeInTheDocument();
  });

  it("renders external link when webViewLink is present", () => {
    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
        initialData={makeInitialData([
          makeFile({ webViewLink: "https://drive.google.com/file/1" }),
        ])}
      />,
    );

    const link = document.querySelector('a[href="https://drive.google.com/file/1"]');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders multiple files", () => {
    const files = [
      makeFile({ id: "f1", name: "File A.pdf" }),
      makeFile({ id: "f2", name: "File B.pdf" }),
      makeFile({ id: "f3", name: "File C.pdf" }),
    ];

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
        initialData={makeInitialData(files)}
      />,
    );

    expect(screen.getByText("File A.pdf")).toBeInTheDocument();
    expect(screen.getByText("File B.pdf")).toBeInTheDocument();
    expect(screen.getByText("File C.pdf")).toBeInTheDocument();
  });
});
