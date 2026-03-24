import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
}));

vi.mock("@/lib/db", () => {
  const chainFn = vi.fn();
  const chain: any = new Proxy({}, {
    get() {
      chainFn.mockReturnValue(chain);
      return chainFn;
    },
  });
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  dealRedFlags: { id: "id", dealId: "dealId", createdAt: "createdAt" },
  dealActivityLog: { dealId: "dealId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => ({ args })),
}));

import { getCurrentUser } from "@/lib/auth";

describe("red-flags actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(mockUser);
  });

  describe("addRedFlag", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

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
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { resolveRedFlag } = await import("./red-flags");
      await expect(
        resolveRedFlag("flag-001", "test-portco", "deal-001")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("unresolveRedFlag", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { unresolveRedFlag } = await import("./red-flags");
      await expect(
        unresolveRedFlag("flag-001", "test-portco", "deal-001")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("removeRedFlag", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { removeRedFlag } = await import("./red-flags");
      await expect(
        removeRedFlag("flag-001", "test-portco", "deal-001")
      ).rejects.toThrow("Unauthorized");
    });
  });
});
