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

  describe("syncFilesToDb", () => {
    it("inserts files into gdrive_file_cache table", async () => {
      const { syncFilesToDb } = await import("./scanner");
      const files = Array.from({ length: 5 }, (_, i) => makeFile(i));

      const result = await syncFilesToDb("portco-1", files);

      expect(mockInsert).toHaveBeenCalled();
      expect(result.upserted).toBe(5);
    });

    it("handles empty file list", async () => {
      const { syncFilesToDb } = await import("./scanner");

      const result = await syncFilesToDb("portco-1", []);

      expect(mockInsert).not.toHaveBeenCalled();
      expect(result.upserted).toBe(0);
    });

    it("batches large file lists", async () => {
      const { syncFilesToDb } = await import("./scanner");
      const files = Array.from({ length: 1200 }, (_, i) => makeFile(i));

      const result = await syncFilesToDb("portco-1", files);

      // 1200 files / 500 batch size = 3 batches
      expect(mockInsert).toHaveBeenCalledTimes(3);
      expect(result.upserted).toBe(1200);
    });

    it("deletes stale files after sync", async () => {
      const { syncFilesToDb } = await import("./scanner");
      const files = [makeFile(0)];

      await syncFilesToDb("portco-1", files);

      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
