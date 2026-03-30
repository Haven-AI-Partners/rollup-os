import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockSelect, mockFrom, mockWhere, mockLimit, mockOrderBy, mockReturning } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockReturning: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
  requirePortcoRole: vi.fn().mockResolvedValue({ user: mockUser, role: "analyst" }),
}));

vi.mock("@/lib/db", () => {
  const chain = () => ({
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    orderBy: mockOrderBy,
    returning: mockReturning,
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: mockReturning }) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: mockReturning }) }) }),
    values: vi.fn().mockReturnValue({ returning: mockReturning }),
    set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: mockReturning }) }),
    delete: vi.fn().mockReturnValue({ where: mockWhere }),
  });
  for (const fn of [mockSelect, mockFrom, mockWhere, mockLimit, mockOrderBy, mockReturning]) {
    fn.mockReturnValue(chain());
  }
  return { db: chain() };
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

import { requirePortcoRole } from "@/lib/auth";

describe("tasks actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "analyst" });
  });

  describe("createTask", () => {
    it("throws when user is not authenticated", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

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
    it("throws when user is not authorized", async () => {
      // updateTask fetches task first, then checks portco role
      mockLimit.mockResolvedValueOnce([{ id: "task-001", portcoId: "portco-001", title: "Task", status: "todo" }]);
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { updateTask } = await import("./tasks");
      await expect(
        updateTask("task-001", "test-portco", "deal-001", { status: "completed" })
      ).rejects.toThrow("Unauthorized");
    });
  });
});
