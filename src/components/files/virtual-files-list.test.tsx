/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { VirtualFilesList, type GDriveFile, type ProcessedInfo, type PageData } from "./virtual-files-list";

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

function mockFetchResponse(
  files: GDriveFile[] = [makeFile()],
  processedMap: Record<string, ProcessedInfo> = { "file-1": { status: "completed", dealId: "d1", fileType: "im_pdf" } },
  nextCursor: number | null = null,
) {
  const data: PageData = {
    files,
    processedMap,
    nextCursor,
    total: files.length + (nextCursor !== null ? 50 : 0),
  };
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VirtualFilesList", () => {
  it("shows loading spinner initially", () => {
    // Never resolve the fetch
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    // Loading spinner should be shown (Loader2 renders an svg)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders file name and metadata after loading", async () => {
    mockFetchResponse();

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Test File.pdf")).toBeInTheDocument();
    });
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("IMs/Subfolder")).toBeInTheDocument();
  });

  it("shows file count summary", async () => {
    mockFetchResponse([makeFile()], undefined, null);

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Showing 1 (filtered) of 1 files")).toBeInTheDocument();
    });
  });

  it("shows empty state when no files returned", async () => {
    mockFetchResponse([], {}, null);

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No files found in this folder.")).toBeInTheDocument();
    });
  });

  it("shows processed badge for completed files", async () => {
    mockFetchResponse(
      [makeFile()],
      { "file-1": { status: "completed", dealId: "deal-1", fileType: "im_pdf" } },
    );

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Processed")).toBeInTheDocument();
    });
  });

  it("shows process button for admins on PDF files", async () => {
    mockFetchResponse(
      [makeFile({ mimeType: "application/pdf" })],
      { "file-1": { status: "pending", dealId: null, fileType: "im_pdf" } },
    );

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={true}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Import & Process")).toBeInTheDocument();
    });
  });

  it("hides process button for non-admins", async () => {
    mockFetchResponse(
      [makeFile({ mimeType: "application/pdf" })],
      { "file-1": { status: "pending", dealId: null, fileType: "im_pdf" } },
    );

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Test File.pdf")).toBeInTheDocument();
    });
    expect(screen.queryByText("Import & Process")).not.toBeInTheDocument();
  });

  it("renders external link when webViewLink is present", async () => {
    mockFetchResponse([
      makeFile({ webViewLink: "https://drive.google.com/file/1" }),
    ]);

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    await waitFor(() => {
      const link = document.querySelector('a[href="https://drive.google.com/file/1"]');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  it("renders multiple files", async () => {
    const files = [
      makeFile({ id: "f1", name: "File A.pdf" }),
      makeFile({ id: "f2", name: "File B.pdf" }),
      makeFile({ id: "f3", name: "File C.pdf" }),
    ];

    mockFetchResponse(files, {
      "f1": { status: "completed", dealId: "d1", fileType: "im_pdf" },
      "f2": { status: "completed", dealId: "d2", fileType: "im_pdf" },
      "f3": { status: "completed", dealId: "d3", fileType: "im_pdf" },
    });

    render(
      <VirtualFilesList
        portcoId="portco-1"
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("File A.pdf")).toBeInTheDocument();
    });
    expect(screen.getByText("File B.pdf")).toBeInTheDocument();
    expect(screen.getByText("File C.pdf")).toBeInTheDocument();
  });

  it("calls fetch with correct portcoId", async () => {
    mockFetchResponse();

    render(
      <VirtualFilesList
        portcoId="my-portco-123"
        portcoSlug="test-co"
        isAdmin={false}
      />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("portcoId=my-portco-123"),
      );
    });
  });

  describe("file type filter pills", () => {
    it("renders filter pills for classified file types", async () => {
      mockFetchResponse(
        [
          makeFile({ id: "f1", name: "IM.pdf" }),
          makeFile({ id: "f2", name: "NDA.pdf" }),
        ],
        {
          "f1": { status: "completed", dealId: "d1", fileType: "im_pdf" },
          "f2": { status: "completed", dealId: "d2", fileType: "nda" },
        },
      );

      render(
        <VirtualFilesList portcoId="portco-1" portcoSlug="test-co" isAdmin={false} />,
      );

      await waitFor(() => {
        expect(screen.getByText("IM.pdf")).toBeInTheDocument();
      });

      // Filter pills should be rendered
      expect(screen.getByRole("button", { name: /^IM/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^NDA/ })).toBeInTheDocument();
    });

    it("defaults to IM filter active", async () => {
      mockFetchResponse(
        [
          makeFile({ id: "f1", name: "IM.pdf" }),
          makeFile({ id: "f2", name: "NDA.pdf" }),
        ],
        {
          "f1": { status: "completed", dealId: "d1", fileType: "im_pdf" },
          "f2": { status: "completed", dealId: "d2", fileType: "nda" },
        },
      );

      render(
        <VirtualFilesList portcoId="portco-1" portcoSlug="test-co" isAdmin={false} />,
      );

      await waitFor(() => {
        expect(screen.getByText("IM.pdf")).toBeInTheDocument();
      });

      // IM is active by default, so NDA should be hidden
      expect(screen.queryByText("NDA.pdf")).not.toBeInTheDocument();

      // Clear button should be visible since IM filter is active
      expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    });

    it("filters files when a pill is toggled", async () => {
      mockFetchResponse(
        [
          makeFile({ id: "f1", name: "IM.pdf" }),
          makeFile({ id: "f2", name: "NDA.pdf" }),
          makeFile({ id: "f3", name: "Other.pdf" }),
        ],
        {
          "f1": { status: "completed", dealId: "d1", fileType: "im_pdf" },
          "f2": { status: "completed", dealId: "d2", fileType: "nda" },
        },
      );

      render(
        <VirtualFilesList portcoId="portco-1" portcoSlug="test-co" isAdmin={false} />,
      );

      await waitFor(() => {
        expect(screen.getByText("IM.pdf")).toBeInTheDocument();
      });

      // Toggle IM off, toggle NDA on — should show only NDA
      fireEvent.click(screen.getByRole("button", { name: /^IM/ }));
      fireEvent.click(screen.getByRole("button", { name: /^NDA/ }));

      expect(screen.queryByText("IM.pdf")).not.toBeInTheDocument();
      expect(screen.getByText("NDA.pdf")).toBeInTheDocument();
      expect(screen.queryByText("Other.pdf")).not.toBeInTheDocument();
    });

    it("shows Unclassified pill for files without a type", async () => {
      mockFetchResponse(
        [
          makeFile({ id: "f1", name: "IM.pdf" }),
          makeFile({ id: "f2", name: "Unknown.pdf" }),
        ],
        {
          "f1": { status: "completed", dealId: "d1", fileType: "im_pdf" },
        },
      );

      render(
        <VirtualFilesList portcoId="portco-1" portcoSlug="test-co" isAdmin={false} />,
      );

      await waitFor(() => {
        expect(screen.getByText("IM.pdf")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /^Unclassified/ })).toBeInTheDocument();
    });

    it("clears filters when Clear button is clicked", async () => {
      mockFetchResponse(
        [
          makeFile({ id: "f1", name: "IM.pdf" }),
          makeFile({ id: "f2", name: "NDA.pdf" }),
        ],
        {
          "f1": { status: "completed", dealId: "d1", fileType: "im_pdf" },
          "f2": { status: "completed", dealId: "d2", fileType: "nda" },
        },
      );

      render(
        <VirtualFilesList portcoId="portco-1" portcoSlug="test-co" isAdmin={false} />,
      );

      await waitFor(() => {
        // IM is active by default, so only IM.pdf visible
        expect(screen.getByText("IM.pdf")).toBeInTheDocument();
      });
      expect(screen.queryByText("NDA.pdf")).not.toBeInTheDocument();

      // Clear the default filter
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));

      // All files should be visible
      expect(screen.getByText("IM.pdf")).toBeInTheDocument();
      expect(screen.getByText("NDA.pdf")).toBeInTheDocument();
    });

    it("allows multiple pills to be toggled simultaneously", async () => {
      mockFetchResponse(
        [
          makeFile({ id: "f1", name: "IM.pdf" }),
          makeFile({ id: "f2", name: "NDA.pdf" }),
          makeFile({ id: "f3", name: "Report.pdf" }),
        ],
        {
          "f1": { status: "completed", dealId: "d1", fileType: "im_pdf" },
          "f2": { status: "completed", dealId: "d2", fileType: "nda" },
          "f3": { status: "completed", dealId: "d3", fileType: "report" },
        },
      );

      render(
        <VirtualFilesList portcoId="portco-1" portcoSlug="test-co" isAdmin={false} />,
      );

      await waitFor(() => {
        // IM active by default
        expect(screen.getByText("IM.pdf")).toBeInTheDocument();
      });

      // Add NDA to active filters (IM + NDA both active)
      fireEvent.click(screen.getByRole("button", { name: /^NDA/ }));

      expect(screen.getByText("IM.pdf")).toBeInTheDocument();
      expect(screen.getByText("NDA.pdf")).toBeInTheDocument();
      expect(screen.queryByText("Report.pdf")).not.toBeInTheDocument();
    });
  });
});
