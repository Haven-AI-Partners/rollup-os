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

vi.mock("@/lib/agents/im-processor/prompt", () => ({
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
import { getFileClassifierStats, getRecentClassifiedFiles } from "./agents";

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
});
