import { describe, it, expect, vi, beforeEach } from "vitest";

// Bypass rate-limit delays in tests
vi.mock("./rate-limit", () => ({
  withRateLimit: (fn: () => Promise<unknown>) => fn(),
}));

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

/**
 * Create a mock drive that returns different children per folder.
 * `folderStructure` maps folderId -> array of children (files and folders).
 */
function makeMockDriveWithFolders(folderStructure: Record<string, Array<{
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}>>) {
  return {
    files: {
      list: vi.fn().mockImplementation(({ q }: { q: string; pageSize: number; pageToken?: string }) => {
        // Extract folder ID from query: "'folderId' in parents and trashed = false"
        const match = q.match(/'([^']+)' in parents/);
        const folderId = match?.[1] ?? "";
        const children = folderStructure[folderId] ?? [];
        return {
          data: {
            files: children,
            nextPageToken: undefined,
          },
        };
      }),
    },
  };
}

const mockGetDriveClient = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock("./client", () => ({
  getDriveClient: (...args: unknown[]) => mockGetDriveClient(...args),
}));

vi.mock("@/lib/db", () => {
  const insertChain: Record<string, unknown> = {};
  insertChain.values = () => insertChain;
  insertChain.onConflictDoUpdate = () => Promise.resolve();

  const deleteChain: Record<string, unknown> = {};
  deleteChain.where = () => Promise.resolve({ rowCount: 0 });

  const defaultSelectChain = () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = () => [];
    chain.then = (resolve: (v: unknown) => void) => resolve([]);
    return chain;
  };

  const updateChain: Record<string, unknown> = {};
  updateChain.set = () => updateChain;
  updateChain.where = () => Promise.resolve();

  return {
    db: {
      insert: (...args: unknown[]) => { mockInsert(...args); return insertChain; },
      delete: (...args: unknown[]) => { mockDelete(...args); return deleteChain; },
      select: (...args: unknown[]) => {
        // If mockSelect has a custom implementation, use its return value as the chain
        const result = mockSelect(...args);
        return result ?? defaultSelectChain();
      },
      update: (...args: unknown[]) => { mockUpdate(...args); return updateChain; },
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  gdriveFileCache: {
    _name: "gdrive_file_cache",
    portcoId: "portco_id",
    gdriveFileId: "gdrive_file_id",
  },
  gdriveScanFolders: {
    _name: "gdrive_scan_folders",
    portcoId: "portco_id",
    gdriveFolderId: "gdrive_folder_id",
    id: "id",
    scanGeneration: "scan_generation",
    lastScannedAt: "last_scanned_at",
  },
  portcos: {
    _name: "portcos",
    id: "id",
    gdriveScanGeneration: "gdrive_scan_generation",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  and: vi.fn(),
  lt: vi.fn(),
  asc: vi.fn(),
  count: vi.fn(),
}));

import { listFilesRecursive, crawlAndSyncFiles, crawlFoldersIncremental } from "./scanner";

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

      await listFilesRecursive("portco-1");

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("returns empty array when no drive configured", async () => {
      mockGetDriveClient.mockResolvedValue(null);

      const files = await listFilesRecursive("portco-1");

      expect(files).toHaveLength(0);
    });

    it("returns empty array when no folder configured", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(10),
        folderId: null,
      });

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


      await crawlAndSyncFiles("portco-1");

      expect(mockDelete).toHaveBeenCalled();
    });

    it("handles empty drive gracefully", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(0),
        folderId: "root-folder",
      });


      const result = await crawlAndSyncFiles("portco-1");

      expect(result.files).toHaveLength(0);
      expect(result.upserted).toBe(0);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("handles no drive configured", async () => {
      mockGetDriveClient.mockResolvedValue(null);


      const result = await crawlAndSyncFiles("portco-1");

      expect(result.files).toHaveLength(0);
      expect(result.upserted).toBe(0);
    });
  });

  describe("crawlFoldersIncremental", () => {
    it("returns early when no drive configured", async () => {
      mockGetDriveClient.mockResolvedValue(null);


      const result = await crawlFoldersIncremental("portco-1", 480_000);

      expect(result.foldersScanned).toBe(0);
      expect(result.filesUpserted).toBe(0);
      expect(result.scanComplete).toBe(true);
    });

    it("returns early when no folder configured", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDrive(10),
        folderId: null,
      });


      const result = await crawlFoldersIncremental("portco-1", 480_000);

      expect(result.scanComplete).toBe(true);
    });

    it("scans folders and upserts files to cache", async () => {
      const drive = makeMockDriveWithFolders({
        "root-folder": Array.from({ length: 5 }, (_, i) => ({
          id: `file-${i}`,
          name: `File ${i}.pdf`,
          mimeType: "application/pdf",
          size: "1024",
          modifiedTime: "2024-01-01T00:00:00Z",
          webViewLink: `https://drive.google.com/file/${i}`,
        })),
      });

      mockGetDriveClient.mockResolvedValue({ drive, folderId: "root-folder" });

      // DB select calls:
      // 1: portco.gdriveScanGeneration
      // 2: count folders with old generation (previous pass check)
      // 3: folders to scan
      // 4: count remaining after scan
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        const n = selectCallCount;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => chain;
        chain.then = (resolve: (v: unknown) => void) => {
          if (n === 1) return resolve([{ gdriveScanGeneration: 0 }]);
          if (n === 2) return resolve([{ cnt: 0 }]); // previous pass done
          if (n === 3) return resolve([{ id: "folder-row-1", gdriveFolderId: "root-folder", parentPath: "", depth: 0 }]);
          if (n === 4) return resolve([{ cnt: 0 }]); // full pass complete
          return resolve([]);
        };
        return chain;
      });


      const result = await crawlFoldersIncremental("portco-1", 480_000);

      expect(result.foldersScanned).toBe(1);
      expect(result.filesUpserted).toBe(5);
      expect(result.scanComplete).toBe(true);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("discovers subfolders and adds them to scan queue", async () => {
      const drive = makeMockDriveWithFolders({
        "root-folder": [
          { id: "subfolder-1", name: "Company A", mimeType: "application/vnd.google-apps.folder" },
          { id: "file-0", name: "README.pdf", mimeType: "application/pdf", size: "512" },
        ],
        "subfolder-1": [
          { id: "file-1", name: "IM.pdf", mimeType: "application/pdf", size: "2048" },
        ],
      });

      mockGetDriveClient.mockResolvedValue({ drive, folderId: "root-folder" });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        const n = selectCallCount;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => chain;
        chain.then = (resolve: (v: unknown) => void) => {
          if (n === 1) return resolve([{ gdriveScanGeneration: 0 }]);
          if (n === 2) return resolve([{ cnt: 0 }]);
          if (n === 3) return resolve([
            { id: "row-1", gdriveFolderId: "root-folder", parentPath: "", depth: 0 },
            { id: "row-2", gdriveFolderId: "subfolder-1", parentPath: "Company A", depth: 1 },
          ]);
          if (n === 4) return resolve([{ cnt: 0 }]);
          return resolve([]);
        };
        return chain;
      });


      const result = await crawlFoldersIncremental("portco-1", 480_000);

      expect(result.foldersScanned).toBe(2);
      expect(result.filesUpserted).toBe(2);
      expect(mockInsert).toHaveBeenCalled();
    });

    it("returns scanComplete=false when folders remain unscanned", async () => {
      const drive = makeMockDriveWithFolders({
        "root-folder": [
          { id: "file-0", name: "File.pdf", mimeType: "application/pdf", size: "1024" },
        ],
      });

      mockGetDriveClient.mockResolvedValue({ drive, folderId: "root-folder" });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        const n = selectCallCount;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => chain;
        chain.then = (resolve: (v: unknown) => void) => {
          if (n === 1) return resolve([{ gdriveScanGeneration: 1 }]);
          if (n === 2) return resolve([{ cnt: 5 }]); // previous pass NOT done
          // currentGen stays at 1, no increment
          if (n === 3) return resolve([
            { id: "row-1", gdriveFolderId: "root-folder", parentPath: "", depth: 0 },
          ]);
          // After scanning 1 folder, 4 still remain
          if (n === 4) return resolve([{ cnt: 4 }]);
          return resolve([]);
        };
        return chain;
      });


      const result = await crawlFoldersIncremental("portco-1", 480_000);

      expect(result.scanComplete).toBe(false);
      // Should not delete stale files when scan is incomplete
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("does not increment generation when previous pass is incomplete", async () => {
      mockGetDriveClient.mockResolvedValue({
        drive: makeMockDriveWithFolders({ "root-folder": [] }),
        folderId: "root-folder",
      });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        const n = selectCallCount;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => chain;
        chain.then = (resolve: (v: unknown) => void) => {
          if (n === 1) return resolve([{ gdriveScanGeneration: 3 }]);
          if (n === 2) return resolve([{ cnt: 2 }]); // 2 folders at old gen → NOT complete
          // No folders to scan (none match scanGeneration < 3, but we still have the root seed)
          if (n === 3) return resolve([]);
          if (n === 4) return resolve([{ cnt: 2 }]); // still remaining
          return resolve([]);
        };
        return chain;
      });


      const result = await crawlFoldersIncremental("portco-1", 480_000);

      expect(result.scanComplete).toBe(false);
      expect(result.foldersScanned).toBe(0);
    });
  });
});
