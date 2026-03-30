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

describe("red-flags actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "analyst" });
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
  });

  describe("resolveRedFlag", () => {
    it("throws when user is not authorized", async () => {
      // DB query returns the flag record
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
  });
});
