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
  dealTasks: { id: "id", dealId: "dealId", position: "position", portcoId: "portcoId", title: "title", status: "status" },
  dealActivityLog: { dealId: "dealId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => ({ args })),
  asc: vi.fn(),
  isNull: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth";

describe("tasks actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(mockUser);
  });

  describe("createTask", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { createTask } = await import("./tasks");
      await expect(
        createTask("deal-001", "portco-001", "test-portco", {
          title: "Do due diligence",
          category: "dd_financial",
        })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("updateTask", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { updateTask } = await import("./tasks");
      await expect(
        updateTask("task-001", "test-portco", "deal-001", { status: "completed" })
      ).rejects.toThrow("Unauthorized");
    });
  });
});
