import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockPortco } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockPortco: { id: "portco-001", name: "Test PortCo", slug: "test-portco" },
}));

vi.mock("@/lib/auth", () => ({
  getPortcoBySlug: vi.fn().mockResolvedValue(mockPortco),
  requirePortcoRole: vi.fn().mockResolvedValue({ user: mockUser, role: "admin" }),
}));

const dbResults: unknown[] = [];
const dbCallTracker = {
  insert: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  values: vi.fn(),
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
  promptVersions: { id: "id", agentSlug: "agentSlug", isActive: "isActive", version: "version" },
  files: { id: "id", portcoId: "portcoId", processingStatus: "processingStatus", processedAt: "processedAt", fileName: "fileName" },
  evalRuns: { id: "id" },
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: vi.fn().mockResolvedValue({ id: "run-001" }) },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => ({ args })),
  desc: vi.fn(),
}));

import { getPortcoBySlug, requirePortcoRole } from "@/lib/auth";

describe("prompt-versions actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbResults.length = 0;
    (getPortcoBySlug as any).mockResolvedValue(mockPortco);
    (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "admin" });
  });

  describe("savePromptVersion", () => {
    it("throws when portco not found", async () => {
      (getPortcoBySlug as any).mockResolvedValue(null);

      const { savePromptVersion } = await import("./prompt-versions");
      await expect(
        savePromptVersion("test-portco", "extraction", "new template")
      ).rejects.toThrow("PortCo not found");
    });

    it("throws when user not authenticated", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { savePromptVersion } = await import("./prompt-versions");
      await expect(
        savePromptVersion("test-portco", "extraction", "new template")
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when user is not admin", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Insufficient permissions"));

      const { savePromptVersion } = await import("./prompt-versions");
      await expect(
        savePromptVersion("test-portco", "extraction", "new template")
      ).rejects.toThrow("Insufficient permissions");
    });

    it("computes next version number from latest", async () => {
      dbResults.push([{ version: 3 }]); // latest version select
      dbResults.push(undefined); // deactivate update
      dbResults.push([{ id: "pv-004", version: 4 }]); // insert returning
      dbResults.push([]); // autoTriggerEval: no recent file found

      const { savePromptVersion } = await import("./prompt-versions");
      const result = await savePromptVersion("test-portco", "extraction", "new template", "test change");

      expect(result).toEqual({ id: "pv-004", version: 4 });
    });

    it("starts at version 1 when no prior versions exist", async () => {
      dbResults.push([]); // no latest version
      dbResults.push(undefined); // deactivate update
      dbResults.push([{ id: "pv-001", version: 1 }]); // insert returning
      dbResults.push([]); // autoTriggerEval: no recent file

      const { savePromptVersion } = await import("./prompt-versions");
      const result = await savePromptVersion("test-portco", "extraction", "first template");

      expect(result).toEqual({ id: "pv-001", version: 1 });
    });

    it("deactivates existing versions before inserting", async () => {
      dbResults.push([{ version: 2 }]); // latest
      dbResults.push(undefined); // deactivate
      dbResults.push([{ id: "pv-003", version: 3 }]); // insert
      dbResults.push([]); // autoTriggerEval

      const { savePromptVersion } = await import("./prompt-versions");
      await savePromptVersion("test-portco", "extraction", "template");

      expect(dbCallTracker.update).toHaveBeenCalled();
      expect(dbCallTracker.set).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });

    it("inserts new version as active", async () => {
      dbResults.push([{ version: 1 }]);
      dbResults.push(undefined);
      dbResults.push([{ id: "pv-002", version: 2 }]);
      dbResults.push([]);

      const { savePromptVersion } = await import("./prompt-versions");
      await savePromptVersion("test-portco", "extraction", "template", "note");

      expect(dbCallTracker.values).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          version: 2,
          template: "template",
          changeNote: "note",
        })
      );
    });
  });

  describe("activatePromptVersion", () => {
    it("throws when user is not admin", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Insufficient permissions"));

      const { activatePromptVersion } = await import("./prompt-versions");
      await expect(
        activatePromptVersion("test-portco", "extraction", "version-001")
      ).rejects.toThrow("Insufficient permissions");
    });

    it("deactivates all then activates specified version", async () => {
      dbResults.push(undefined); // deactivate all
      dbResults.push(undefined); // activate specified
      dbResults.push([{ id: "pv-002", version: 2 }]); // select activated
      dbResults.push([]); // autoTriggerEval

      const { activatePromptVersion } = await import("./prompt-versions");
      await activatePromptVersion("test-portco", "extraction", "pv-002");

      expect(dbCallTracker.update).toHaveBeenCalled();
      // First set call deactivates, second activates
      const setCalls = dbCallTracker.set.mock.calls;
      expect(setCalls[0][0]).toEqual({ isActive: false });
      expect(setCalls[1][0]).toEqual({ isActive: true });
    });
  });

  describe("resetToDefaultPrompt", () => {
    it("throws when user is not admin", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Insufficient permissions"));

      const { resetToDefaultPrompt } = await import("./prompt-versions");
      await expect(
        resetToDefaultPrompt("test-portco", "extraction")
      ).rejects.toThrow("Insufficient permissions");
    });

    it("deactivates all active versions", async () => {
      dbResults.push(undefined); // deactivate all
      dbResults.push([]); // autoTriggerEval: no file

      const { resetToDefaultPrompt } = await import("./prompt-versions");
      await resetToDefaultPrompt("test-portco", "extraction");

      expect(dbCallTracker.update).toHaveBeenCalled();
      expect(dbCallTracker.set).toHaveBeenCalledWith({ isActive: false });
    });
  });
});
