import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GDriveFileWithPath } from "./scanner";

function makeFile(index: number): GDriveFileWithPath {
  return {
    id: `file-${index}`,
    name: `File ${index}.pdf`,
    mimeType: "application/pdf",
    size: "1024",
    modifiedTime: "2024-01-01T00:00:00Z",
    webViewLink: `https://drive.google.com/file/${index}`,
    parentPath: "root",
  };
}

// Simulate a drive with N files via a mock that returns pages from files.list
function makeMockDrive(totalFiles: number) {
  const allFiles = Array.from({ length: totalFiles }, (_, i) => ({
    id: `file-${i}`,
    name: `File ${i}.pdf`,
    mimeType: "application/pdf",
    size: "1024",
    modifiedTime: "2024-01-01T00:00:00Z",
    webViewLink: `https://drive.google.com/file/${i}`,
  }));

  return {
    files: {
      list: vi.fn().mockImplementation(({ pageSize, pageToken }: { pageSize: number; pageToken?: string }) => {
        const offset = pageToken ? parseInt(pageToken, 10) : 0;
        const slice = allFiles.slice(offset, offset + pageSize);
        const nextOffset = offset + pageSize;
        return {
          data: {
            files: slice,
            nextPageToken: nextOffset < allFiles.length ? String(nextOffset) : undefined,
          },
        };
      }),
    },
  };
}

const mockGetDriveClient = vi.fn();

vi.mock("./client", () => ({
  getDriveClient: (...args: unknown[]) => mockGetDriveClient(...args),
}));

describe("scanner", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Invalidate cache between tests by re-importing
    const { invalidateFilesCache } = await import("./scanner");
    invalidateFilesCache("portco-1");
  });

  describe("listFilesPage", () => {
    it("returns first page of files with hasMore=true when more exist", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(120),
        folderId: "root-folder",
      });

      const { listFilesPage, invalidateFilesCache } = await import("./scanner");
      invalidateFilesCache("portco-1");

      const result = await listFilesPage("portco-1", 0, 50);
      expect(result.files).toHaveLength(50);
      expect(result.hasMore).toBe(true);
    });

    it("returns second page after first page (incomplete cache re-crawls)", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(120),
        folderId: "root-folder",
      });

      const { listFilesPage, invalidateFilesCache } = await import("./scanner");
      invalidateFilesCache("portco-1");

      // Page 1
      const page1 = await listFilesPage("portco-1", 0, 50);
      expect(page1.files).toHaveLength(50);
      expect(page1.hasMore).toBe(true);

      // Page 2 — the key scenario that was broken
      const page2 = await listFilesPage("portco-1", 50, 50);
      expect(page2.files).toHaveLength(50);
      expect(page2.hasMore).toBe(true);
      // Files should be different from page 1
      expect(page2.files[0].id).toBe("file-50");
    });

    it("returns third page with remaining files and hasMore=false when complete", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(120),
        folderId: "root-folder",
      });

      const { listFilesPage, invalidateFilesCache } = await import("./scanner");
      invalidateFilesCache("portco-1");

      await listFilesPage("portco-1", 0, 50);
      await listFilesPage("portco-1", 50, 50);
      const page3 = await listFilesPage("portco-1", 100, 50);

      expect(page3.files).toHaveLength(20);
      expect(page3.hasMore).toBe(false);
      expect(page3.total).toBe(120);
    });

    it("uses complete cache without re-crawling", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(80),
        folderId: "root-folder",
      });

      const { listFilesPage, listFilesRecursive, invalidateFilesCache } = await import("./scanner");
      invalidateFilesCache("portco-1");

      // Warm the full cache
      await listFilesRecursive("portco-1");
      const callsAfterWarm = mockGetDriveClient.mock.calls.length;

      // Subsequent page requests should use cache
      const page1 = await listFilesPage("portco-1", 0, 50);
      const page2 = await listFilesPage("portco-1", 50, 50);

      expect(page1.files).toHaveLength(50);
      expect(page1.total).toBe(80);
      expect(page2.files).toHaveLength(30);
      expect(page2.hasMore).toBe(false);
      // No additional getDriveClient calls
      expect(mockGetDriveClient.mock.calls.length).toBe(callsAfterWarm);
    });

    it("returns empty files and hasMore=false when no drive configured", async () => {
      mockGetDriveClient.mockResolvedValue(null);

      const { listFilesPage, invalidateFilesCache } = await import("./scanner");
      invalidateFilesCache("portco-1");

      const result = await listFilesPage("portco-1", 0, 50);
      expect(result.files).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("invalidateFilesCache", () => {
    it("forces re-crawl after invalidation", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(10),
        folderId: "root-folder",
      });

      const { listFilesPage, invalidateFilesCache } = await import("./scanner");
      invalidateFilesCache("portco-1");

      await listFilesPage("portco-1", 0, 50);
      const callsBefore = mockGetDriveClient.mock.calls.length;

      invalidateFilesCache("portco-1");
      await listFilesPage("portco-1", 0, 50);

      // Should have called getDriveClient again after invalidation
      expect(mockGetDriveClient.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
