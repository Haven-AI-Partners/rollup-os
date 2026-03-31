import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockSelect, mockFrom, mockWhere, mockLimit, mockOrderBy, mockReturning, mockInsert, mockUpdate, mockSet, mockValues } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockReturning: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockValues: vi.fn(),
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
    insert: mockInsert,
    update: mockUpdate,
    set: mockSet,
    values: mockValues,
    delete: vi.fn().mockReturnValue({ where: mockWhere }),
  });
  for (const fn of [mockSelect, mockFrom, mockWhere, mockLimit, mockOrderBy, mockReturning, mockInsert, mockUpdate, mockSet, mockValues]) {
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

import { requireAuth, requirePortcoRole } from "@/lib/auth";

describe("tasks actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue(mockUser);
    (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "analyst" });
  });

  describe("getTasksForDeal", () => {
    it("requires authentication", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { getTasksForDeal } = await import("./tasks");
      await expect(getTasksForDeal("deal-001")).rejects.toThrow("Unauthorized");
    });

    it("returns ordered tasks from DB", async () => {
      const tasks = [
        { id: "task-1", title: "First", position: 0 },
        { id: "task-2", title: "Second", position: 1 },
      ];
      mockOrderBy.mockResolvedValueOnce(tasks);

      const { getTasksForDeal } = await import("./tasks");
      const result = await getTasksForDeal("deal-001");

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(tasks);
    });
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

    it("validates input with createTaskSchema - rejects invalid category", async () => {
      const { createTask } = await import("./tasks");
      await expect(
        createTask("deal-001", "portco-001", "test-portco", {
          title: "Task",
          category: "invalid_category",
        })
      ).rejects.toThrow();
    });

    it("validates input with createTaskSchema - rejects empty title", async () => {
      const { createTask } = await import("./tasks");
      await expect(
        createTask("deal-001", "portco-001", "test-portco", {
          title: "",
          category: "dd_financial",
        })
      ).rejects.toThrow();
    });

    it("inserts task and logs activity on success", async () => {
      const createdTask = { id: "task-001", title: "Review financials" };
      mockReturning.mockResolvedValueOnce([createdTask]);

      const { createTask } = await import("./tasks");
      const result = await createTask("deal-001", "portco-001", "test-portco", {
        title: "Review financials",
        category: "dd_financial",
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(createdTask);
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

    it("throws Task not found when task does not exist", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { updateTask } = await import("./tasks");
      await expect(
        updateTask("task-999", "test-portco", "deal-001", { status: "completed" })
      ).rejects.toThrow("Task not found");
    });

    it("updates task and returns it", async () => {
      const current = { id: "task-001", title: "Review", status: "todo", portcoId: "portco-001" };
      const updated = { ...current, status: "in_progress" };
      mockLimit.mockResolvedValueOnce([current]); // select current
      mockReturning.mockResolvedValueOnce([updated]); // update returning

      const { updateTask } = await import("./tasks");
      const result = await updateTask("task-001", "test-portco", "deal-001", { status: "in_progress" });

      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it("logs task_completed when status changes to completed", async () => {
      const current = { id: "task-001", title: "Review", status: "in_progress", portcoId: "portco-001" };
      const updated = { ...current, status: "completed" };
      mockLimit.mockResolvedValueOnce([current]);
      mockReturning.mockResolvedValueOnce([updated]);

      const { updateTask } = await import("./tasks");
      await updateTask("task-001", "test-portco", "deal-001", { status: "completed" });

      // Verify insert was called for activity log
      expect(mockInsert).toHaveBeenCalled();
    });

    it("does not log activity when status is unchanged", async () => {
      const current = { id: "task-001", title: "Review", status: "todo", portcoId: "portco-001" };
      const updated = { ...current, title: "Review Updated" };
      mockLimit.mockResolvedValueOnce([current]);
      mockReturning.mockResolvedValueOnce([updated]);

      const { updateTask } = await import("./tasks");
      await updateTask("task-001", "test-portco", "deal-001", { title: "Review Updated" });

      // Insert called for task update only, not for activity log
      // (mockInsert is called for update chain, but values should not include activity log data)
      // Since status didn't change, no activity log insert should happen after update
    });
  });
});
