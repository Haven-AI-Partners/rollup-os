import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCrawlAndSyncFiles,
  mockCrawlFoldersIncremental,
  mockClassifyFile,
  mockProcessDDDocument,
  mockTasksTrigger,
} = vi.hoisted(() => ({
  mockCrawlAndSyncFiles: vi.fn(),
  mockCrawlFoldersIncremental: vi.fn(),
  mockClassifyFile: vi.fn(),
  mockProcessDDDocument: vi.fn(),
  mockTasksTrigger: vi.fn(),
}));

let dbCallIndex = 0;
let dbResolvedValues: unknown[][] = [];

function createChainProxy(): object {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        const values = dbResolvedValues[dbCallIndex] ?? [];
        dbCallIndex++;
        return (resolve: (v: unknown) => void) => resolve(values);
      }
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          const values = dbResolvedValues[dbCallIndex] ?? [];
          dbCallIndex++;
          return (resolve: (v: unknown) => void) => resolve(values);
        }
        return () => createChainProxy();
      },
    },
  ),
}));

vi.mock("@/lib/db/schema", () => ({
  files: {
    id: "id",
    gdriveFileId: "gdriveFileId",
    portcoId: "portcoId",
    processingStatus: "processingStatus",
  },
  deals: {
    id: "id",
    portcoId: "portcoId",
    companyName: "companyName",
  },
  gdriveFileCache: {
    gdriveFileId: "gdriveFileId",
    portcoId: "portcoId",
    mimeType: "mimeType",
    fileName: "fileName",
    sizeBytes: "sizeBytes",
    webViewLink: "webViewLink",
    parentPath: "parentPath",
  },
}));

vi.mock("@/lib/gdrive/scanner", () => ({
  crawlAndSyncFiles: (...args: unknown[]) => mockCrawlAndSyncFiles(...args),
  crawlFoldersIncremental: (...args: unknown[]) => mockCrawlFoldersIncremental(...args),
}));

vi.mock("./file-classifier", () => ({
  classifyFile: (...args: unknown[]) => mockClassifyFile(...args),
}));

vi.mock("./dd-processor", () => ({
  processDDDocument: (...args: unknown[]) => mockProcessDDDocument(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  inArray: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => ({ args })),
  sql: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: (...args: unknown[]) => mockTasksTrigger(...args) },
}));

describe("scan-orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCallIndex = 0;
    dbResolvedValues = [];
  });

  describe("scanClassifyAndProcess", () => {
    it("returns empty result when no files from crawl", async () => {
      mockCrawlAndSyncFiles.mockResolvedValue({ files: [] });

      const { scanClassifyAndProcess } = await import("./scan-orchestrator");
      const result = await scanClassifyAndProcess("portco-001");

      expect(result.totalFiles).toBe(0);
      expect(result.newFiles).toBe(0);
      expect(result.classified).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it("returns skipped result when all files already exist", async () => {
      const crawledFiles = [
        { id: "gf-001", name: "Existing.pdf", mimeType: "application/pdf", parentPath: "Root", size: "1024", webViewLink: "https://drive.google.com/file/1" },
        { id: "gf-002", name: "AlsoExisting.pdf", mimeType: "application/pdf", parentPath: "Root", size: "2048", webViewLink: "https://drive.google.com/file/2" },
      ];
      mockCrawlAndSyncFiles.mockResolvedValue({ files: crawledFiles });

      // DB call 0: dedup query - all files already exist
      dbResolvedValues = [
        [{ gdriveFileId: "gf-001", processingStatus: "done" }, { gdriveFileId: "gf-002", processingStatus: "done" }],
      ];

      const { scanClassifyAndProcess } = await import("./scan-orchestrator");
      const result = await scanClassifyAndProcess("portco-001");

      expect(result.totalFiles).toBe(2);
      expect(result.newFiles).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe("skipped");
    });

    it("classifies and routes IM files correctly", async () => {
      const crawledFiles = [
        { id: "gf-new", name: "CIM.pdf", mimeType: "application/pdf", parentPath: "Root/IMs", size: "5000", webViewLink: "https://drive.google.com/file/new" },
      ];
      mockCrawlAndSyncFiles.mockResolvedValue({ files: crawledFiles });

      // DB call 0: dedup query - no existing files
      // DB call 1: matchDeal candidate "Root" - no match
      // DB call 2: matchDeal candidate "IMs" - no match
      // DB call 3: insert file record
      dbResolvedValues = [
        [],                       // dedup: no existing
        [],                       // matchDeal: "Root" no match
        [],                       // matchDeal: "IMs" no match
        [{ id: "file-001" }],     // insert returning
      ];

      mockClassifyFile.mockResolvedValue({
        fileType: "im_pdf",
        confidence: 0.9,
        tier: "rules",
        suggestedCompanyName: null,
      });
      mockTasksTrigger.mockResolvedValue({ id: "run-001" });

      const { scanClassifyAndProcess } = await import("./scan-orchestrator");
      const result = await scanClassifyAndProcess("portco-001");

      expect(result.newFiles).toBe(1);
      expect(result.classified).toBe(1);
      expect(result.imsRouted).toBe(1);
      expect(result.results[0].status).toBe("im_routed");
      expect(result.results[0].fileType).toBe("im_pdf");
      expect(mockTasksTrigger).toHaveBeenCalledWith("process-im", expect.objectContaining({
        fileId: "file-001",
        portcoId: "portco-001",
      }));
    });

    it("classifies and routes Excel files correctly", async () => {
      const crawledFiles = [
        { id: "gf-xlsx", name: "財務データ.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", parentPath: "Root/Data", size: "3000", webViewLink: "https://drive.google.com/file/xlsx" },
      ];
      mockCrawlAndSyncFiles.mockResolvedValue({ files: crawledFiles });

      // DB call 0: dedup query - no existing
      // DB call 1: matchDeal "Root" - no match
      // DB call 2: matchDeal "Data" - no match
      // DB call 3: insert file record
      dbResolvedValues = [
        [],
        [],
        [],
        [{ id: "file-xlsx-001" }],
      ];

      mockClassifyFile.mockResolvedValue({
        fileType: "excel_data",
        confidence: 0.85,
        tier: "rules",
        suggestedCompanyName: null,
      });
      mockTasksTrigger.mockResolvedValue({ id: "run-excel-001" });

      const { scanClassifyAndProcess } = await import("./scan-orchestrator");
      const result = await scanClassifyAndProcess("portco-001");

      expect(result.newFiles).toBe(1);
      expect(result.classified).toBe(1);
      expect(result.excelRouted).toBe(1);
      expect(result.results[0].status).toBe("excel_routed");
      expect(result.results[0].fileType).toBe("excel_data");
      expect(mockTasksTrigger).toHaveBeenCalledWith("translate-excel", expect.objectContaining({
        fileId: "file-xlsx-001",
        portcoId: "portco-001",
        gdriveFileId: "gf-xlsx",
      }));
    });

    it("handles Excel trigger failure gracefully", async () => {
      const crawledFiles = [
        { id: "gf-xlsx-fail", name: "data.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", parentPath: "Root", size: "2000", webViewLink: null },
      ];
      mockCrawlAndSyncFiles.mockResolvedValue({ files: crawledFiles });

      dbResolvedValues = [
        [],
        [],
        [{ id: "file-xlsx-002" }],
      ];

      mockClassifyFile.mockResolvedValue({
        fileType: "excel_data",
        confidence: 0.8,
        tier: "rules",
        suggestedCompanyName: null,
      });
      mockTasksTrigger.mockRejectedValue(new Error("Queue full"));

      const { scanClassifyAndProcess } = await import("./scan-orchestrator");
      const result = await scanClassifyAndProcess("portco-001");

      expect(result.excelRouted).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].status).toBe("failed");
      expect(result.results[0].error).toBe("Queue full");
    });

    it("handles classification failures gracefully", async () => {
      const crawledFiles = [
        { id: "gf-fail", name: "Corrupt.pdf", mimeType: "application/pdf", parentPath: "Root", size: "100", webViewLink: "https://drive.google.com/file/fail" },
      ];
      mockCrawlAndSyncFiles.mockResolvedValue({ files: crawledFiles });

      // DB call 0: dedup query - no existing
      dbResolvedValues = [
        [],
      ];

      mockClassifyFile.mockRejectedValue(new Error("Vision API timeout"));

      const { scanClassifyAndProcess } = await import("./scan-orchestrator");
      const result = await scanClassifyAndProcess("portco-001");

      expect(result.newFiles).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.classified).toBe(0);
      expect(result.results[0].status).toBe("failed");
      expect(result.results[0].error).toBe("Vision API timeout");
    });
  });

  describe("scanClassifyAndProcessIncremental", () => {
    it("returns empty when no cached PDFs", async () => {
      mockCrawlFoldersIncremental.mockResolvedValue({
        filesUpserted: 0,
        scanComplete: true,
        foldersErrored: 0,
      });

      // DB call 0: cached PDFs query - none
      dbResolvedValues = [
        [],
      ];

      const { scanClassifyAndProcessIncremental } = await import("./scan-orchestrator");
      const result = await scanClassifyAndProcessIncremental("portco-001", 10000);

      expect(result.totalFiles).toBe(0);
      expect(result.newFiles).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(result.scanComplete).toBe(true);
      expect(result.foldersErrored).toBe(0);
    });

    it("returns skipped when all cached PDFs already imported", async () => {
      mockCrawlFoldersIncremental.mockResolvedValue({
        filesUpserted: 5,
        scanComplete: false,
        foldersErrored: 1,
      });

      // DB call 0: cached PDFs query
      // DB call 1: dedup query - all exist
      dbResolvedValues = [
        [
          { gdriveFileId: "gf-001", fileName: "Doc1.pdf", mimeType: "application/pdf", sizeBytes: 1024, webViewLink: "https://drive.google.com/1", parentPath: "Root" },
          { gdriveFileId: "gf-002", fileName: "Doc2.pdf", mimeType: "application/pdf", sizeBytes: 2048, webViewLink: "https://drive.google.com/2", parentPath: "Root" },
        ],
        [{ gdriveFileId: "gf-001" }, { gdriveFileId: "gf-002" }],
      ];

      const { scanClassifyAndProcessIncremental } = await import("./scan-orchestrator");
      const result = await scanClassifyAndProcessIncremental("portco-001", 10000);

      expect(result.totalFiles).toBe(2);
      expect(result.newFiles).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.scanComplete).toBe(false);
      expect(result.foldersErrored).toBe(1);
    });
  });
});
