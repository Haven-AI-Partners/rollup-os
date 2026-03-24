import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
  requirePortcoRole: vi.fn().mockResolvedValue({ user: mockUser, role: "analyst" }),
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

import { requireAuth, requirePortcoRole } from "@/lib/auth";

describe("red-flags actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue(mockUser);
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
    it("throws when user is not authenticated", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { resolveRedFlag } = await import("./red-flags");
      await expect(
        resolveRedFlag("flag-001", "test-portco", "deal-001")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("unresolveRedFlag", () => {
    it("throws when user is not authenticated", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { unresolveRedFlag } = await import("./red-flags");
      await expect(
        unresolveRedFlag("flag-001", "test-portco", "deal-001")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("removeRedFlag", () => {
    it("throws when user is not authenticated", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { removeRedFlag } = await import("./red-flags");
      await expect(
        removeRedFlag("flag-001", "test-portco", "deal-001")
      ).rejects.toThrow("Unauthorized");
    });
  });
});
