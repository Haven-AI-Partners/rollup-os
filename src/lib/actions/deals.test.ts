import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
const { mockInsert, mockUpdate, mockSelect, mockDelete, mockFrom, mockWhere, mockSet, mockValues, mockReturning, mockLimit, mockOrderBy, mockGroupBy, mockUser, mockInnerJoin, mockLeftJoin } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockSet: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockGroupBy: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockLeftJoin: vi.fn(),
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
  requirePortcoRole: vi.fn().mockResolvedValue({ user: mockUser, role: "analyst" }),
}));

vi.mock("@/lib/db", () => {
  const chain = () => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    from: mockFrom,
    where: mockWhere,
    set: mockSet,
    values: mockValues,
    returning: mockReturning,
    limit: mockLimit,
    orderBy: mockOrderBy,
    groupBy: mockGroupBy,
    innerJoin: mockInnerJoin,
    leftJoin: mockLeftJoin,
  });
  // Make each mock return the chain
  for (const fn of [mockSelect, mockInsert, mockUpdate, mockDelete, mockFrom, mockWhere, mockSet, mockValues, mockLimit, mockOrderBy, mockGroupBy, mockInnerJoin, mockLeftJoin]) {
    fn.mockReturnValue(chain());
  }
  return { db: chain() };
});

vi.mock("@/lib/db/schema", () => ({
  deals: { id: "id", portcoId: "portcoId", stageId: "stageId", companyName: "companyName", kanbanPosition: "kanbanPosition", status: "status" },
  pipelineStages: { id: "id", portcoId: "portcoId", position: "position", name: "name" },
  dealComments: { id: "id", dealId: "dealId", createdAt: "createdAt" },
  dealTransfers: {},
  dealActivityLog: { dealId: "dealId", createdAt: "createdAt" },
  companyProfiles: { dealId: "dealId", aiOverallScore: "aiOverallScore" },
  dealRedFlags: { id: "id", dealId: "dealId", resolved: "resolved", severity: "severity" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  asc: vi.fn((col) => ({ type: "asc", col })),
  desc: vi.fn((col) => ({ type: "desc", col })),
  count: vi.fn((col) => ({ type: "count", col })),
  inArray: vi.fn((col, vals) => ({ type: "inArray", col, vals })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

import { requireAuth, requirePortcoRole } from "@/lib/auth";

describe("deals actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth mocks
    (requireAuth as any).mockResolvedValue(mockUser);
    (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "analyst" });
  });

  describe("getDealsForPortco", () => {
    it("requires authentication", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { getDealsForPortco } = await import("./deals");
      await expect(getDealsForPortco("portco-001")).rejects.toThrow("Unauthorized");
    });

    it("returns empty array when no deals exist", async () => {
      mockOrderBy.mockResolvedValueOnce([]);

      const { getDealsForPortco } = await import("./deals");
      const result = await getDealsForPortco("portco-001");

      expect(requireAuth).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("createDeal", () => {
    it("throws when user is not authenticated", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { createDeal } = await import("./deals");
      await expect(
        createDeal("portco-001", "test-portco", {
          companyName: "Test Co",
          stageId: "stage-001",
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("enforces analyst role for writes", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Insufficient permissions"));

      const { createDeal } = await import("./deals");
      await expect(
        createDeal("portco-001", "test-portco", {
          companyName: "Test Co",
          stageId: "stage-001",
        })
      ).rejects.toThrow("Insufficient permissions");
    });

    it("calls insert with correct values", async () => {
      const mockDeal = { id: "deal-001", companyName: "Test Co" };
      mockReturning.mockResolvedValueOnce([mockDeal]);
      mockReturning.mockResolvedValueOnce([{}]); // activity log

      const { createDeal } = await import("./deals");
      const result = await createDeal("portco-001", "test-portco", {
        companyName: "Test Co",
        stageId: "stage-001",
        source: "broker_referral",
      });

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "analyst");
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
      expect(result).toEqual(mockDeal);
    });
  });

  describe("updateDeal", () => {
    it("throws when user is not authenticated", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { updateDeal } = await import("./deals");
      await expect(
        updateDeal("deal-001", "test-portco", { companyName: "Updated" })
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when deal not found", async () => {
      mockLimit.mockResolvedValueOnce([]); // no deal found

      const { updateDeal } = await import("./deals");
      await expect(
        updateDeal("deal-001", "test-portco", { companyName: "Updated" })
      ).rejects.toThrow("Deal not found");
    });
  });

  describe("addComment", () => {
    it("throws when user is not authenticated", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { addComment } = await import("./deals");
      await expect(
        addComment("deal-001", "portco-001", "test-portco", "Nice deal!")
      ).rejects.toThrow("Unauthorized");
    });

    it("enforces analyst role", async () => {
      const mockComment = { id: "comment-001", content: "Nice deal!" };
      mockReturning.mockResolvedValueOnce([mockComment]);
      mockReturning.mockResolvedValueOnce([{}]); // activity log

      const { addComment } = await import("./deals");
      await addComment("deal-001", "portco-001", "test-portco", "Nice deal!");

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "analyst");
    });
  });

  describe("getStagesForPortco", () => {
    it("requires authentication", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { getStagesForPortco } = await import("./deals");
      await expect(getStagesForPortco("portco-001")).rejects.toThrow("Unauthorized");
    });
  });
});
