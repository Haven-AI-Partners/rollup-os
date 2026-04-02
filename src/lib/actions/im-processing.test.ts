import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUser,
  mockPortco,
  mockRequireAuth,
  mockRequirePortcoRole,
  mockGetPortcoBySlug,
  mockTasksTrigger,
} = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockPortco: { id: "portco-001", name: "Test PortCo", slug: "test-portco" },
  mockRequireAuth: vi.fn(),
  mockRequirePortcoRole: vi.fn(),
  mockGetPortcoBySlug: vi.fn(),
  mockTasksTrigger: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  requirePortcoRole: mockRequirePortcoRole,
  getPortcoBySlug: mockGetPortcoBySlug,
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: mockTasksTrigger },
}));

vi.mock("@/lib/agents/im-processor", () => ({
  MODEL_ID: "gemini-2.5-flash",
}));

const dbResults: unknown[] = [];
const dbCallTracker = {
  insert: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  values: vi.fn(),
  select: vi.fn(),
};

vi.mock("@/lib/db", () => {
  const chain: any = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          if (dbResults.length === 0) return undefined;
          const val = dbResults.shift();
          return (resolve: (v: unknown) => void) => {
            resolve(val);
            return { then: () => {} };
          };
        }
        if (prop in dbCallTracker) {
          return (...args: unknown[]) => {
            (dbCallTracker as any)[prop](...args);
            return chain;
          };
        }
        // db.query.files.findFirst — "query" and its children are property accesses
        if (prop === "query" || prop === "files") return chain;
        return () => chain;
      },
    }
  );
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  files: { id: "id", portcoId: "portcoId", dealId: "dealId", gdriveFileId: "gdriveFileId", processingStatus: "processingStatus", processedAt: "processedAt", fileName: "fileName" },
  deals: { id: "id", portcoId: "portcoId" },
  evalRuns: { id: "id" },
  promptVersions: { id: "id", agentSlug: "agentSlug", isActive: "isActive", version: "version" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => ({ args })),
  desc: vi.fn(),
}));

describe("im-processing actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbResults.length = 0;
    mockGetPortcoBySlug.mockResolvedValue(mockPortco);
    mockRequirePortcoRole.mockResolvedValue({ user: mockUser, role: "admin" });
    mockRequireAuth.mockResolvedValue(mockUser);
    mockTasksTrigger.mockResolvedValue({ id: "run-001" });
  });

  describe("processIMFile", () => {
    it("throws when portco not found", async () => {
      mockGetPortcoBySlug.mockResolvedValue(null);

      const { processIMFile } = await import("./im-processing");
      await expect(processIMFile("bad-slug", "file-001")).rejects.toThrow("PortCo not found");
    });

    it("throws when file not found", async () => {
      dbResults.push([]); // empty select

      const { processIMFile } = await import("./im-processing");
      await expect(processIMFile("test-portco", "file-999")).rejects.toThrow("File not found");
    });

    it("throws when file has no deal", async () => {
      dbResults.push([{ id: "file-001", dealId: null, portcoId: "portco-001" }]);

      const { processIMFile } = await import("./im-processing");
      await expect(processIMFile("test-portco", "file-001")).rejects.toThrow("File has no associated deal");
    });

    it("triggers processing and returns run ID", async () => {
      const file = { id: "file-001", dealId: "deal-001", portcoId: "portco-001" };
      dbResults.push([file]); // select file
      dbResults.push(undefined); // update status

      const { processIMFile } = await import("./im-processing");
      const result = await processIMFile("test-portco", "file-001");

      expect(result).toEqual({ triggered: true, runId: "run-001" });
      expect(mockTasksTrigger).toHaveBeenCalled();
    });
  });

  describe("importGdriveFile", () => {
    it("throws when portco not found", async () => {
      mockGetPortcoBySlug.mockResolvedValue(null);

      const { importGdriveFile } = await import("./im-processing");
      await expect(
        importGdriveFile("bad-slug", "deal-001", "gdrive-001", "file.pdf", "application/pdf", 1000, null)
      ).rejects.toThrow("PortCo not found");
    });

    it("throws when deal not found", async () => {
      dbResults.push([]); // deal select

      const { importGdriveFile } = await import("./im-processing");
      await expect(
        importGdriveFile("test-portco", "deal-999", "gdrive-001", "file.pdf", "application/pdf", 1000, null)
      ).rejects.toThrow("Deal not found");
    });

    it("returns alreadyExists when file already imported", async () => {
      dbResults.push([{ id: "deal-001", portcoId: "portco-001" }]); // deal select
      dbResults.push([{ id: "file-001", processingStatus: "completed" }]); // existing file

      const { importGdriveFile } = await import("./im-processing");
      const result = await importGdriveFile(
        "test-portco", "deal-001", "gdrive-001", "file.pdf", "application/pdf", 1000, null
      );

      expect(result).toEqual({ fileId: "file-001", success: true, alreadyExists: true });
    });

    it("re-triggers processing on existing file when autoProcess and not completed", async () => {
      dbResults.push([{ id: "deal-001", portcoId: "portco-001" }]); // deal
      dbResults.push([{ id: "file-001", processingStatus: "pending" }]); // existing

      const { importGdriveFile } = await import("./im-processing");
      const result = await importGdriveFile(
        "test-portco", "deal-001", "gdrive-001", "file.pdf", "application/pdf", 1000, null, true
      );

      expect(result).toEqual({ fileId: "file-001", triggered: true });
      expect(mockTasksTrigger).toHaveBeenCalled();
    });

    it("inserts new file and auto-processes PDF", async () => {
      dbResults.push([{ id: "deal-001", portcoId: "portco-001" }]); // deal
      dbResults.push([]); // no existing file
      dbResults.push([{ id: "file-new" }]); // insert returning

      const { importGdriveFile } = await import("./im-processing");
      const result = await importGdriveFile(
        "test-portco", "deal-001", "gdrive-001", "IM_TestCorp.pdf", "application/pdf", 1000, null, true
      );

      expect(result).toEqual({ fileId: "file-new", triggered: true });
      expect(mockTasksTrigger).toHaveBeenCalled();
      expect(dbCallTracker.insert).toHaveBeenCalled();
    });
  });

  describe("scanGdriveFolder", () => {
    it("throws when portco not found", async () => {
      mockGetPortcoBySlug.mockResolvedValue(null);

      const { scanGdriveFolder } = await import("./im-processing");
      await expect(scanGdriveFolder("bad-slug")).rejects.toThrow("PortCo not found");
    });

    it("triggers scan and returns run ID", async () => {
      const { scanGdriveFolder } = await import("./im-processing");
      const result = await scanGdriveFolder("test-portco");

      expect(result).toEqual({ triggered: true, runId: "run-001" });
    });
  });

  describe("reprocessAllIMFiles", () => {
    it("throws when portco not found", async () => {
      mockGetPortcoBySlug.mockResolvedValue(null);

      const { reprocessAllIMFiles } = await import("./im-processing");
      await expect(reprocessAllIMFiles("bad-slug")).rejects.toThrow("PortCo not found");
    });

    it("triggers reprocessing and returns run ID", async () => {
      const { reprocessAllIMFiles } = await import("./im-processing");
      const result = await reprocessAllIMFiles("test-portco");

      expect(result).toEqual({ triggered: true, runId: "run-001" });
    });
  });

  describe("processSingleFile", () => {
    it("throws when portco not found", async () => {
      mockGetPortcoBySlug.mockResolvedValue(null);

      const { processSingleFile } = await import("./im-processing");
      await expect(
        processSingleFile("bad-slug", "gdrive-001", "file.pdf", "application/pdf", 1000, null)
      ).rejects.toThrow("PortCo not found");
    });

    it("triggers processing and returns run ID", async () => {
      const { processSingleFile } = await import("./im-processing");
      const result = await processSingleFile(
        "test-portco", "gdrive-001", "file.pdf", "application/pdf", 1000, null
      );

      expect(result).toEqual({ triggered: true, runId: "run-001" });
    });
  });

  describe("translateExcel", () => {
    it("throws when portco not found", async () => {
      mockGetPortcoBySlug.mockResolvedValue(null);

      const { translateExcel } = await import("./im-processing");
      await expect(
        translateExcel("bad-slug", "gdrive-1", "test.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", null, null),
      ).rejects.toThrow("PortCo not found");
    });

    it("creates a new file record and triggers task when file does not exist", async () => {
      // db.query.files.findFirst → null (no existing file)
      dbResults.push(null);
      // db.insert.returning → new file record
      dbResults.push([{ id: "new-file-001" }]);

      const { translateExcel } = await import("./im-processing");
      const result = await translateExcel(
        "test-portco", "gdrive-1", "data.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        5000, "https://drive.google.com/file/1",
      );

      expect(result).toEqual({ triggered: true, runId: "run-001" });
      expect(mockTasksTrigger).toHaveBeenCalledWith("translate-excel", {
        fileId: "new-file-001",
        portcoId: "portco-001",
        gdriveFileId: "gdrive-1",
      });
    });

    it("reuses existing file record when file already exists", async () => {
      // db.query.files.findFirst → existing file
      dbResults.push({ id: "existing-file-001" });

      const { translateExcel } = await import("./im-processing");
      const result = await translateExcel(
        "test-portco", "gdrive-1", "data.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        null, null,
      );

      expect(result).toEqual({ triggered: true, runId: "run-001" });
      expect(mockTasksTrigger).toHaveBeenCalledWith("translate-excel", {
        fileId: "existing-file-001",
        portcoId: "portco-001",
        gdriveFileId: "gdrive-1",
      });
    });
  });

  describe("triggerEvalRun", () => {
    it("throws when portco not found", async () => {
      mockGetPortcoBySlug.mockResolvedValue(null);

      const { triggerEvalRun } = await import("./im-processing");
      await expect(triggerEvalRun("bad-slug", "file-001")).rejects.toThrow("PortCo not found");
    });

    it("throws when file not found", async () => {
      dbResults.push([]); // file select

      const { triggerEvalRun } = await import("./im-processing");
      await expect(triggerEvalRun("test-portco", "file-999")).rejects.toThrow("File not found");
    });

    it("creates eval run and triggers task", async () => {
      const file = { id: "file-001", fileName: "IM_test.pdf", portcoId: "portco-001" };
      dbResults.push([file]); // file select
      dbResults.push([{ id: "pv-001", version: 2 }]); // active prompt
      dbResults.push([{ id: "eval-001" }]); // eval run insert

      const { triggerEvalRun } = await import("./im-processing");
      const result = await triggerEvalRun("test-portco", "file-001");

      expect(result).toEqual({ triggered: true, runId: "run-001", evalRunId: "eval-001" });
      expect(mockTasksTrigger).toHaveBeenCalled();
    });
  });
});
