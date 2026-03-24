import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
const { mockInsert, mockUpdate, mockSelect, mockDelete, mockFrom, mockWhere, mockSet, mockValues, mockReturning, mockLimit, mockOrderBy, mockUser } = vi.hoisted(() => ({
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
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
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
  });
  // Make each mock return the chain
  for (const fn of [mockSelect, mockInsert, mockUpdate, mockDelete, mockFrom, mockWhere, mockSet, mockValues, mockLimit, mockOrderBy]) {
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
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  asc: vi.fn((col) => ({ type: "asc", col })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

import { getCurrentUser } from "@/lib/auth";

describe("deals actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth mock
    (getCurrentUser as any).mockResolvedValue(mockUser);
  });

  describe("createDeal", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { createDeal } = await import("./deals");
      await expect(
        createDeal("portco-001", "test-portco", {
          companyName: "Test Co",
          stageId: "stage-001",
        })
      ).rejects.toThrow("Unauthorized");
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

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
      expect(result).toEqual(mockDeal);
    });
  });

  describe("updateDeal", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { updateDeal } = await import("./deals");
      await expect(
        updateDeal("deal-001", "test-portco", { companyName: "Updated" })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("addComment", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { addComment } = await import("./deals");
      await expect(
        addComment("deal-001", "portco-001", "test-portco", "Nice deal!")
      ).rejects.toThrow("Unauthorized");
    });
  });
});
