import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPortco, mockUser } = vi.hoisted(() => ({
  mockPortco: { id: "portco-001", name: "Test PortCo", slug: "test-portco" },
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

const mockNotFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

vi.mock("@/lib/auth", () => ({
  getPortcoBySlug: vi.fn().mockResolvedValue(mockPortco),
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
  getUserPortcoRole: vi.fn().mockResolvedValue("analyst"),
  hasMinRole: vi.fn((role: string, minRole: string) => {
    const order = ["viewer", "analyst", "admin", "owner"];
    return order.indexOf(role) >= order.indexOf(minRole);
  }),
}));

const dbResults: unknown[] = [];

vi.mock("@/lib/db", () => {
  const chain: unknown = new Proxy(
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
    },
  );
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  promptVersions: {
    id: "id",
    version: "version",
    template: "template",
    isActive: "isActive",
    changeNote: "changeNote",
    createdAt: "createdAt",
    agentSlug: "agentSlug",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  desc: vi.fn((a) => ({ desc: a })),
}));

import {
  getPortcoBySlug,
  getCurrentUser,
  getUserPortcoRole,
} from "@/lib/auth";

describe("page-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbResults.length = 0;
    (getPortcoBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(mockPortco);
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getUserPortcoRole as ReturnType<typeof vi.fn>).mockResolvedValue("analyst");
  });

  describe("getAgentPageAuth", () => {
    it("calls notFound when portco does not exist", async () => {
      (getPortcoBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getAgentPageAuth } = await import("./page-helpers");

      await expect(getAgentPageAuth("nonexistent")).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("returns isAnalyst true and isAdmin false for analyst role", async () => {
      (getUserPortcoRole as ReturnType<typeof vi.fn>).mockResolvedValue("analyst");

      const { getAgentPageAuth } = await import("./page-helpers");
      const result = await getAgentPageAuth("test-portco");

      expect(result.portco).toEqual(mockPortco);
      expect(result.isAnalyst).toBe(true);
      expect(result.isAdmin).toBe(false);
    });

    it("returns isAdmin true and isAnalyst true for admin role", async () => {
      (getUserPortcoRole as ReturnType<typeof vi.fn>).mockResolvedValue("admin");

      const { getAgentPageAuth } = await import("./page-helpers");
      const result = await getAgentPageAuth("test-portco");

      expect(result.isAnalyst).toBe(true);
      expect(result.isAdmin).toBe(true);
    });

    it("returns both flags false when user is not authenticated", async () => {
      (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getAgentPageAuth } = await import("./page-helpers");
      const result = await getAgentPageAuth("test-portco");

      expect(result.isAnalyst).toBe(false);
      expect(result.isAdmin).toBe(false);
    });

    it("returns both flags false for viewer role", async () => {
      (getUserPortcoRole as ReturnType<typeof vi.fn>).mockResolvedValue("viewer");

      const { getAgentPageAuth } = await import("./page-helpers");
      const result = await getAgentPageAuth("test-portco");

      expect(result.isAnalyst).toBe(false);
      expect(result.isAdmin).toBe(false);
    });
  });

  describe("getPromptVersionsForAgent", () => {
    it("returns versions and rendered prompt when active version exists", async () => {
      const versions = [
        {
          id: "pv-002",
          version: 2,
          template: "Active template: {{var}}",
          isActive: true,
          changeNote: "Updated",
          createdAt: new Date("2025-01-02"),
        },
        {
          id: "pv-001",
          version: 1,
          template: "First template",
          isActive: false,
          changeNote: "Initial",
          createdAt: new Date("2025-01-01"),
        },
      ];
      dbResults.push(versions);

      const { getPromptVersionsForAgent } = await import("./page-helpers");
      const result = await getPromptVersionsForAgent("extraction", "default template");

      expect(result.currentTemplate).toBe("Active template: {{var}}");
      expect(result.renderedPrompt).toBe("Active template: {{var}}");
      expect(result.versionsForClient).toHaveLength(2);
      expect(result.versionsForClient[0].id).toBe("pv-002");
      expect(result.versionsForClient[0].createdAt).toBe("2025-01-02T00:00:00.000Z");
    });

    it("uses default template when no active version exists", async () => {
      const versions = [
        {
          id: "pv-001",
          version: 1,
          template: "Old template",
          isActive: false,
          changeNote: "Deactivated",
          createdAt: new Date("2025-01-01"),
        },
      ];
      dbResults.push(versions);

      const { getPromptVersionsForAgent } = await import("./page-helpers");
      const result = await getPromptVersionsForAgent("extraction", "default template");

      expect(result.currentTemplate).toBe("default template");
      expect(result.renderedPrompt).toBe("default template");
    });

    it("uses default template when no versions exist at all", async () => {
      dbResults.push([]);

      const { getPromptVersionsForAgent } = await import("./page-helpers");
      const result = await getPromptVersionsForAgent("extraction", "default template");

      expect(result.currentTemplate).toBe("default template");
      expect(result.renderedPrompt).toBe("default template");
      expect(result.versionsForClient).toHaveLength(0);
    });

    it("applies renderFn to the active template", async () => {
      const versions = [
        {
          id: "pv-001",
          version: 1,
          template: "Hello {{name}}",
          isActive: true,
          changeNote: null,
          createdAt: new Date("2025-01-01"),
        },
      ];
      dbResults.push(versions);

      const renderFn = (t: string) => t.replace("{{name}}", "World");

      const { getPromptVersionsForAgent } = await import("./page-helpers");
      const result = await getPromptVersionsForAgent("extraction", "default", renderFn);

      expect(result.currentTemplate).toBe("Hello {{name}}");
      expect(result.renderedPrompt).toBe("Hello World");
    });

    it("applies renderFn to default template when no active version", async () => {
      dbResults.push([]);

      const renderFn = (t: string) => t.toUpperCase();

      const { getPromptVersionsForAgent } = await import("./page-helpers");
      const result = await getPromptVersionsForAgent("extraction", "default", renderFn);

      expect(result.renderedPrompt).toBe("DEFAULT");
    });
  });
});
