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
  portcos: { slug: "slug" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

import { getCurrentUser } from "@/lib/auth";

describe("settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(mockUser);
  });

  describe("updateGdriveFolderId", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { updateGdriveFolderId } = await import("./settings");
      await expect(
        updateGdriveFolderId("test-portco", "folder-123")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("disconnectGdrive", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { disconnectGdrive } = await import("./settings");
      await expect(
        disconnectGdrive("test-portco")
      ).rejects.toThrow("Unauthorized");
    });
  });
});
