import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockPortco } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockPortco: { id: "portco-001", name: "Test PortCo", slug: "test-portco" },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
  getPortcoBySlug: vi.fn().mockResolvedValue(mockPortco),
  getUserPortcoRole: vi.fn().mockResolvedValue("admin"),
  hasMinRole: vi.fn().mockReturnValue(true),
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

import { getCurrentUser, getPortcoBySlug, getUserPortcoRole, hasMinRole } from "@/lib/auth";

describe("prompt-versions actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(mockUser);
    (getPortcoBySlug as any).mockResolvedValue(mockPortco);
    (getUserPortcoRole as any).mockResolvedValue("admin");
    (hasMinRole as any).mockReturnValue(true);
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
      (getCurrentUser as any).mockResolvedValue(null);

      const { savePromptVersion } = await import("./prompt-versions");
      await expect(
        savePromptVersion("test-portco", "extraction", "new template")
      ).rejects.toThrow("Not authenticated");
    });

    it("throws when user is not admin", async () => {
      (hasMinRole as any).mockReturnValue(false);

      const { savePromptVersion } = await import("./prompt-versions");
      await expect(
        savePromptVersion("test-portco", "extraction", "new template")
      ).rejects.toThrow("Admin access required");
    });
  });

  describe("activatePromptVersion - auth checks", () => {
    it("throws when user is not admin", async () => {
      (hasMinRole as any).mockReturnValue(false);

      const { activatePromptVersion } = await import("./prompt-versions");
      await expect(
        activatePromptVersion("test-portco", "extraction", "version-001")
      ).rejects.toThrow("Admin access required");
    });
  });

  describe("resetToDefaultPrompt - auth checks", () => {
    it("throws when user is not admin", async () => {
      (hasMinRole as any).mockReturnValue(false);

      const { resetToDefaultPrompt } = await import("./prompt-versions");
      await expect(
        resetToDefaultPrompt("test-portco", "extraction")
      ).rejects.toThrow("Admin access required");
    });
  });
});
