import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockPortco } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockPortco: { id: "portco-001", name: "Test PortCo", slug: "test-portco" },
}));

vi.mock("@/lib/auth", () => ({
  getPortcoBySlug: vi.fn().mockResolvedValue(mockPortco),
  requirePortcoRole: vi.fn().mockResolvedValue({ user: mockUser, role: "admin" }),
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
    (getPortcoBySlug as any).mockResolvedValue(mockPortco);
    (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "admin" });
  });

  describe("savePromptVersion - auth checks", () => {
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
  });

  describe("activatePromptVersion - auth checks", () => {
    it("throws when user is not admin", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Insufficient permissions"));

      const { activatePromptVersion } = await import("./prompt-versions");
      await expect(
        activatePromptVersion("test-portco", "extraction", "version-001")
      ).rejects.toThrow("Insufficient permissions");
    });
  });

  describe("resetToDefaultPrompt - auth checks", () => {
    it("throws when user is not admin", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Insufficient permissions"));

      const { resetToDefaultPrompt } = await import("./prompt-versions");
      await expect(
        resetToDefaultPrompt("test-portco", "extraction")
      ).rejects.toThrow("Insufficient permissions");
    });
  });
});
