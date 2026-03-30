import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
}));

const dbResults: unknown[] = [];
const dbCallTracker = {
  update: vi.fn(),
  set: vi.fn(),
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
        return () => chain;
      },
    }
  );
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  portcos: { slug: "slug" },
  gdriveApiErrors: {
    id: "id",
    httpStatus: "httpStatus",
    context: "context",
    attempt: "attempt",
    exhausted: "exhausted",
    createdAt: "createdAt",
    portcoId: "portcoId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => ({ args })),
  desc: vi.fn(),
  gte: vi.fn((a, b) => ({ a, b, op: "gte" })),
}));

import { requireAuth } from "@/lib/auth";

describe("settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbResults.length = 0;
    (requireAuth as any).mockResolvedValue(mockUser);
  });

  describe("updateGdriveFolderId", () => {
    it("throws when user is not authenticated", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { updateGdriveFolderId } = await import("./settings");
      await expect(
        updateGdriveFolderId("test-portco", "folder-123")
      ).rejects.toThrow("Unauthorized");
    });

    it("calls db.update with folder ID", async () => {
      dbResults.push(undefined); // update resolves

      const { updateGdriveFolderId } = await import("./settings");
      await updateGdriveFolderId("test-portco", "folder-123");

      expect(dbCallTracker.update).toHaveBeenCalled();
      expect(dbCallTracker.set).toHaveBeenCalled();
      const setArg = dbCallTracker.set.mock.calls[0][0];
      expect(setArg.gdriveFolderId).toBe("folder-123");
    });

    it("handles null folderId for disconnection", async () => {
      dbResults.push(undefined);

      const { updateGdriveFolderId } = await import("./settings");
      await updateGdriveFolderId("test-portco", null);

      expect(dbCallTracker.set).toHaveBeenCalled();
      const setArg = dbCallTracker.set.mock.calls[0][0];
      expect(setArg.gdriveFolderId).toBeNull();
    });
  });

  describe("disconnectGdrive", () => {
    it("throws when user is not authenticated", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { disconnectGdrive } = await import("./settings");
      await expect(
        disconnectGdrive("test-portco")
      ).rejects.toThrow("Unauthorized");
    });

    it("sets both service account and folder ID to null", async () => {
      dbResults.push(undefined);

      const { disconnectGdrive } = await import("./settings");
      await disconnectGdrive("test-portco");

      expect(dbCallTracker.set).toHaveBeenCalled();
      const setArg = dbCallTracker.set.mock.calls[0][0];
      expect(setArg.gdriveServiceAccountEnc).toBeNull();
      expect(setArg.gdriveFolderId).toBeNull();
    });
  });

  describe("getRecentGdriveErrors", () => {
    it("throws when user is not authenticated", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { getRecentGdriveErrors } = await import("./settings");
      await expect(getRecentGdriveErrors("portco-001")).rejects.toThrow("Unauthorized");
    });

    it("returns errors from DB", async () => {
      const errors = [
        { id: "err-1", httpStatus: 429, context: "list_files" },
        { id: "err-2", httpStatus: 500, context: "get_file" },
      ];
      dbResults.push(errors);

      const { getRecentGdriveErrors } = await import("./settings");
      const result = await getRecentGdriveErrors("portco-001");

      expect(dbCallTracker.select).toHaveBeenCalled();
      expect(result).toEqual(errors);
    });

    it("returns empty array when no errors", async () => {
      dbResults.push([]);

      const { getRecentGdriveErrors } = await import("./settings");
      const result = await getRecentGdriveErrors("portco-001");

      expect(result).toEqual([]);
    });
  });
});
