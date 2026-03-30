import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
}));

const dbResults: unknown[] = [];

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
        return () => chain;
      },
    }
  );
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  fileExtractions: { fileId: "fileId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

import { requireAuth } from "@/lib/auth";

describe("file-extractions actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbResults.length = 0;
    (requireAuth as any).mockResolvedValue(mockUser);
  });

  describe("getFileExtraction", () => {
    it("requires authentication", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { getFileExtraction } = await import("./file-extractions");
      await expect(getFileExtraction("file-001")).rejects.toThrow("Unauthorized");
    });

    it("returns extraction when found", async () => {
      const extraction = { id: "ext-001", fileId: "file-001", content: "extracted data" };
      dbResults.push([extraction]);

      const { getFileExtraction } = await import("./file-extractions");
      const result = await getFileExtraction("file-001");

      expect(result).toEqual(extraction);
    });

    it("returns null when no extraction exists", async () => {
      dbResults.push([]);

      const { getFileExtraction } = await import("./file-extractions");
      const result = await getFileExtraction("file-999");

      expect(result).toBeNull();
    });
  });
});
