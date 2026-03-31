import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
}));

// Build a chainable mock where every method returns the chain,
// and the chain itself is a thenable so `await` resolves it.
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
  get db() {
    return createChainProxy();
  },
}));

vi.mock("@/lib/db/schema", () => ({
  files: {
    id: "id", portcoId: "portcoId", fileType: "fileType",
    classifiedBy: "classifiedBy", classificationConfidence: "classificationConfidence",
    fileName: "fileName", gdriveParentPath: "gdriveParentPath", dealId: "dealId",
    createdAt: "createdAt", processingStatus: "processingStatus",
    processedAt: "processedAt", updatedAt: "updatedAt",
  },
  deals: { id: "id", companyName: "companyName", portcoId: "portcoId" },
  companyProfiles: { dealId: "dealId", aiOverallScore: "aiOverallScore" },
  promptVersions: { agentSlug: "agentSlug", version: "version" },
  evalRuns: { agentSlug: "agentSlug", createdAt: "createdAt" },
}));

vi.mock("@/lib/agents/im-processor/prompts/shared", () => ({
  AGENT_SLUG: "im-processor",
  EXTRACTION_SLUG: "im-processor-extraction",
  SCORING_SLUG: "im-processor-scoring",
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((col) => ({ type: "desc", col })),
  count: vi.fn((col) => ({ type: "count", col })),
  avg: vi.fn((col) => ({ type: "avg", col })),
  isNotNull: vi.fn((col) => ({ type: "isNotNull", col })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

import { requireAuth } from "@/lib/auth";
import {
  getFileClassifierStats,
  getRecentClassifiedFiles,
  getAgentStats,
  getRecentProcessedFiles,
  getProcessedFilesForEval,
  getRecentEvalRuns,
  getAllPromptVersions,
} from "./agents";

describe("agents actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    dbCallIndex = 0;
    dbResolvedValues = [];
  });

  describe("getFileClassifierStats", () => {
    it("requires authentication", async () => {
      dbResolvedValues = [
        [], // typeCounts
        [{ avgConfidence: null }], // confidenceStats
        [{ count: 0 }], // totalClassified
      ];

      await getFileClassifierStats("portco-001");

      expect(requireAuth).toHaveBeenCalled();
    });

    it("returns type counts, confidence, and totals", async () => {
      dbResolvedValues = [
        [{ fileType: "im_pdf", count: 5 }, { fileType: "dd_financial", count: 3 }],
        [{ avgConfidence: "0.85" }],
        [{ count: 10 }],
      ];

      const result = await getFileClassifierStats("portco-001");

      expect(result.autoClassified).toBe(8);
      expect(result.totalClassified).toBe(10);
      expect(result.typeCounts).toHaveLength(2);
      expect(result.typeCounts[0]).toEqual({ fileType: "im_pdf", count: 5 });
    });

    it("handles empty results", async () => {
      dbResolvedValues = [
        [],
        [{ avgConfidence: null }],
        [{ count: 0 }],
      ];

      const result = await getFileClassifierStats("portco-001");

      expect(result.autoClassified).toBe(0);
      expect(result.totalClassified).toBe(0);
      expect(result.avgConfidence).toBeNull();
      expect(result.typeCounts).toHaveLength(0);
    });
  });

  describe("getRecentClassifiedFiles", () => {
    it("requires authentication", async () => {
      dbResolvedValues = [[]];

      await getRecentClassifiedFiles("portco-001");

      expect(requireAuth).toHaveBeenCalled();
    });

    it("returns recent classified files", async () => {
      const mockFiles = [
        {
          id: "file-1",
          fileName: "test.pdf",
          fileType: "im_pdf",
          classifiedBy: "auto",
          classificationConfidence: "0.95",
          gdriveParentPath: "/Company/IM",
          dealId: "deal-1",
          companyName: "Test Corp",
          createdAt: new Date(),
        },
      ];
      dbResolvedValues = [mockFiles];

      const result = await getRecentClassifiedFiles("portco-001");

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe("test.pdf");
      expect(result[0].fileType).toBe("im_pdf");
    });
  });

  describe("getAgentStats", () => {
    it("requires authentication", async () => {
      (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));
      await expect(getAgentStats("portco-001")).rejects.toThrow("Unauthorized");
    });

    it("returns aggregated stats", async () => {
      dbResolvedValues = [
        [{ status: "completed", count: 5 }, { status: "failed", count: 2 }, { status: "processing", count: 1 }],
        [{ avgScore: "78.5" }],
      ];

      const result = await getAgentStats("portco-001");

      expect(result.completed).toBe(5);
      expect(result.failed).toBe(2);
      expect(result.inProgress).toBe(1);
      expect(result.total).toBe(8);
      expect(result.avgScore).toBe(78.5);
    });

    it("returns null avgScore when no scores", async () => {
      dbResolvedValues = [
        [],
        [{ avgScore: null }],
      ];

      const result = await getAgentStats("portco-001");
      expect(result.avgScore).toBeNull();
      expect(result.total).toBe(0);
    });
  });

  describe("getRecentProcessedFiles", () => {
    it("requires authentication", async () => {
      (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));
      await expect(getRecentProcessedFiles("portco-001")).rejects.toThrow("Unauthorized");
    });

    it("returns recent processed files", async () => {
      const mockFiles = [
        { fileId: "f1", fileName: "test.pdf", status: "completed", companyName: "Test Corp" },
      ];
      dbResolvedValues = [mockFiles];

      const result = await getRecentProcessedFiles("portco-001");
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe("test.pdf");
    });
  });

  describe("getProcessedFilesForEval", () => {
    it("requires authentication", async () => {
      (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));
      await expect(getProcessedFilesForEval("portco-001")).rejects.toThrow("Unauthorized");
    });

    it("returns completed files", async () => {
      dbResolvedValues = [[{ id: "f1", fileName: "test.pdf", dealId: "d1", companyName: "Corp" }]];
      const result = await getProcessedFilesForEval("portco-001");
      expect(result).toHaveLength(1);
    });
  });

  describe("getRecentEvalRuns", () => {
    it("requires authentication", async () => {
      (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));
      await expect(getRecentEvalRuns()).rejects.toThrow("Unauthorized");
    });

    it("returns eval runs", async () => {
      const runs = [{ id: "run-1", status: "completed", iterations: 3 }];
      dbResolvedValues = [runs];
      const result = await getRecentEvalRuns();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("completed");
    });
  });

  describe("getAllPromptVersions", () => {
    it("requires authentication", async () => {
      (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));
      await expect(getAllPromptVersions()).rejects.toThrow("Unauthorized");
    });

    it("returns versions for all slugs", async () => {
      const v1 = [{ id: "v1", version: 1, isActive: true }];
      const v2 = [{ id: "v2", version: 1, isActive: true }];
      const v3 = [{ id: "v3", version: 1, isActive: false }];
      dbResolvedValues = [v1, v2, v3];

      const result = await getAllPromptVersions();
      expect(result.extractionVersions).toEqual(v1);
      expect(result.scoringVersions).toEqual(v2);
      expect(result.legacyVersions).toEqual(v3);
    });
  });
});
