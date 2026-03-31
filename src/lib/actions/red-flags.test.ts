import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockSelect, mockFrom, mockWhere, mockLimit, mockOrderBy, mockUpdate, mockSet, mockReturning, mockDelete } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockReturning: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
  requirePortcoRole: vi.fn().mockResolvedValue({ user: mockUser, role: "analyst" }),
}));

vi.mock("@/lib/db", () => {
  const chain = () => ({
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    orderBy: mockOrderBy,
    update: mockUpdate,
    set: mockSet,
    returning: mockReturning,
    delete: mockDelete,
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: mockReturning }) }),
    values: vi.fn().mockReturnValue({ returning: mockReturning }),
  });
  for (const fn of [mockSelect, mockFrom, mockWhere, mockLimit, mockOrderBy, mockUpdate, mockSet, mockReturning, mockDelete]) {
    fn.mockReturnValue(chain());
  }
  return { db: chain() };
});

vi.mock("@/lib/db/schema", () => ({
  deals: { id: "id", portcoId: "portcoId" },
  dealRedFlags: { id: "id", dealId: "dealId", portcoId: "portcoId", createdAt: "createdAt" },
  dealActivityLog: { dealId: "dealId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => ({ args })),
}));

import { requirePortcoRole } from "@/lib/auth";

vi.mock("./schemas", () => ({
  addRedFlagSchema: {
    parse: vi.fn((data: unknown) => data),
  },
}));

describe("red-flags actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "analyst" });
    // Reset chain returns
    for (const fn of [mockSelect, mockFrom, mockWhere, mockLimit, mockOrderBy, mockUpdate, mockSet, mockReturning, mockDelete]) {
      fn.mockReturnValue({
        select: mockSelect, from: mockFrom, where: mockWhere, limit: mockLimit,
        orderBy: mockOrderBy, update: mockUpdate, set: mockSet, returning: mockReturning,
        delete: mockDelete, insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: mockReturning }) }),
        values: vi.fn().mockReturnValue({ returning: mockReturning }),
      });
    }
  });

  describe("getRedFlagsForDeal", () => {
    it("throws when deal not found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getRedFlagsForDeal } = await import("./red-flags");
      await expect(getRedFlagsForDeal("deal-999")).rejects.toThrow("Deal not found");
    });

    it("returns red flags for a deal", async () => {
      mockLimit.mockResolvedValueOnce([{ id: "deal-001", portcoId: "portco-001" }]);
      const flags = [{ id: "flag-1", severity: "critical" }];
      mockOrderBy.mockResolvedValueOnce(flags);

      const { getRedFlagsForDeal } = await import("./red-flags");
      const result = await getRedFlagsForDeal("deal-001");
      expect(result).toEqual(flags);
    });
  });

  describe("addRedFlag", () => {
    it("throws when user is not authenticated", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { addRedFlag } = await import("./red-flags");
      await expect(
        addRedFlag("deal-001", "portco-001", "test-portco", {
          flagId: "crit_fin_neg_cashflow",
          severity: "critical",
          category: "financial",
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("creates a red flag and logs activity", async () => {
      const mockFlag = { id: "flag-001", flagId: "crit_fin_neg_cashflow", severity: "critical" };
      mockReturning.mockResolvedValueOnce([mockFlag]); // insert flag
      mockReturning.mockResolvedValueOnce([{}]); // activity log

      const { addRedFlag } = await import("./red-flags");
      const result = await addRedFlag("deal-001", "portco-001", "test-portco", {
        flagId: "crit_fin_neg_cashflow",
        severity: "critical",
        category: "financial",
      });

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "analyst");
      expect(result).toEqual(mockFlag);
    });
  });

  describe("resolveRedFlag", () => {
    it("throws when user is not authorized", async () => {
      mockLimit.mockResolvedValueOnce([{ id: "flag-001", portcoId: "portco-001" }]);
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { resolveRedFlag } = await import("./red-flags");
      await expect(
        resolveRedFlag("flag-001", "test-portco", "deal-001")
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when flag not found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { resolveRedFlag } = await import("./red-flags");
      await expect(
        resolveRedFlag("flag-999", "test-portco", "deal-001")
      ).rejects.toThrow("Red flag not found");
    });

    it("resolves a red flag successfully", async () => {
      mockLimit.mockResolvedValueOnce([{ id: "flag-001", portcoId: "portco-001" }]);
      mockReturning.mockResolvedValueOnce([{ id: "flag-001", resolved: true }]);

      const { resolveRedFlag } = await import("./red-flags");
      await resolveRedFlag("flag-001", "test-portco", "deal-001");

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "analyst");
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe("unresolveRedFlag", () => {
    it("throws when user is not authorized", async () => {
      mockLimit.mockResolvedValueOnce([{ id: "flag-001", portcoId: "portco-001" }]);
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { unresolveRedFlag } = await import("./red-flags");
      await expect(
        unresolveRedFlag("flag-001", "test-portco", "deal-001")
      ).rejects.toThrow("Unauthorized");
    });

    it("unresolves a red flag successfully", async () => {
      mockLimit.mockResolvedValueOnce([{ id: "flag-001", portcoId: "portco-001" }]);
      mockReturning.mockResolvedValueOnce([{ id: "flag-001", resolved: false }]);

      const { unresolveRedFlag } = await import("./red-flags");
      await unresolveRedFlag("flag-001", "test-portco", "deal-001");

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "analyst");
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe("removeRedFlag", () => {
    it("throws when user is not authorized", async () => {
      mockLimit.mockResolvedValueOnce([{ id: "flag-001", portcoId: "portco-001" }]);
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { removeRedFlag } = await import("./red-flags");
      await expect(
        removeRedFlag("flag-001", "test-portco", "deal-001")
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when flag not found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { removeRedFlag } = await import("./red-flags");
      await expect(removeRedFlag("flag-999", "test-portco", "deal-001")).rejects.toThrow("Red flag not found");
    });

    it("deletes the red flag when authorized", async () => {
      mockLimit.mockResolvedValueOnce([{ id: "flag-001", portcoId: "portco-001" }]);
      (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "admin" });

      const { removeRedFlag } = await import("./red-flags");
      await removeRedFlag("flag-001", "test-portco", "deal-001");

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "admin");
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
