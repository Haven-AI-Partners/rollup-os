import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GDriveFileWithPath } from "./scanner";

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
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("./client", () => ({
  getDriveClient: (...args: unknown[]) => mockGetDriveClient(...args),
}));

vi.mock("@/lib/db", () => {
  const insertChain: Record<string, unknown> = {};
  insertChain.values = () => insertChain;
  insertChain.onConflictDoUpdate = () => Promise.resolve();

  const deleteChain: Record<string, unknown> = {};
  deleteChain.where = () => Promise.resolve({ rowCount: 0 });

  return {
    db: {
      insert: (...args: unknown[]) => { mockInsert(...args); return insertChain; },
      delete: (...args: unknown[]) => { mockDelete(...args); return deleteChain; },
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  gdriveFileCache: {
    _name: "gdrive_file_cache",
    portcoId: "portco_id",
    gdriveFileId: "gdrive_file_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  and: vi.fn(),
  lt: vi.fn(),
}));

describe("scanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listFilesRecursive", () => {
    it("returns all files from GDrive", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(80),
        folderId: "root-folder",
      });

      const { listFilesRecursive } = await import("./scanner");
      const files = await listFilesRecursive("portco-1");

      expect(files).toHaveLength(80);
      expect(files[0].id).toBe("file-0");
      expect(files[79].id).toBe("file-79");
    });

    it("does not write to DB", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(10),
        folderId: "root-folder",
      });

      const { listFilesRecursive } = await import("./scanner");
      await listFilesRecursive("portco-1");

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("returns empty array when no drive configured", async () => {
      mockGetDriveClient.mockResolvedValue(null);

      const { listFilesRecursive } = await import("./scanner");
      const files = await listFilesRecursive("portco-1");

      expect(files).toHaveLength(0);
    });

    it("returns empty array when no folder configured", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(10),
        folderId: null,
      });

      const { listFilesRecursive } = await import("./scanner");
      const files = await listFilesRecursive("portco-1");

      expect(files).toHaveLength(0);
    });
  });

  describe("crawlAndSyncFiles", () => {
    it("upserts files incrementally during crawl", async () => {
      // 450 files with pageSize=200 means 3 pages (200 + 200 + 50)
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(450),
        folderId: "root-folder",
      });

      const { crawlAndSyncFiles } = await import("./scanner");
      const result = await crawlAndSyncFiles("portco-1");

      expect(result.files).toHaveLength(450);
      expect(result.upserted).toBe(450);
      // Should have called insert 3 times (once per page), not once at the end
      expect(mockInsert).toHaveBeenCalledTimes(3);
    });

    it("returns all files even with multiple pages", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(500),
        folderId: "root-folder",
      });

      const { crawlAndSyncFiles } = await import("./scanner");
      const result = await crawlAndSyncFiles("portco-1");

      expect(result.files).toHaveLength(500);
      expect(result.files[0].id).toBe("file-0");
      expect(result.files[499].id).toBe("file-499");
    });

    it("deletes stale files after crawl completes", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(10),
        folderId: "root-folder",
      });

      const { crawlAndSyncFiles } = await import("./scanner");
      await crawlAndSyncFiles("portco-1");

      expect(mockDelete).toHaveBeenCalled();
    });

    it("handles empty drive gracefully", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(0),
        folderId: "root-folder",
      });

      const { crawlAndSyncFiles } = await import("./scanner");
      const result = await crawlAndSyncFiles("portco-1");

      expect(result.files).toHaveLength(0);
      expect(result.upserted).toBe(0);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("handles no drive configured", async () => {
      mockGetDriveClient.mockResolvedValue(null);

      const { crawlAndSyncFiles } = await import("./scanner");
      const result = await crawlAndSyncFiles("portco-1");

      expect(result.files).toHaveLength(0);
      expect(result.upserted).toBe(0);
    });
  });
});
