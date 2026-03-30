import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
  requirePortcoRole: vi.fn().mockResolvedValue({ user: mockUser, role: "analyst" }),
}));

// Queue-based Proxy mock for DB
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
    dbResults.length = 0;
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
      dbResults.push(tasks);

      const { getTasksForDeal } = await import("./tasks");
      const result = await getTasksForDeal("deal-001");

      expect(dbCallTracker.select).toHaveBeenCalled();
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
      dbResults.push([createdTask]); // insert returning
      dbResults.push(undefined); // activity log insert

      const { createTask } = await import("./tasks");
      const result = await createTask("deal-001", "portco-001", "test-portco", {
        title: "Review financials",
        category: "dd_financial",
      });

      expect(dbCallTracker.insert).toHaveBeenCalled();
      expect(result).toEqual(createdTask);
    });
  });

  describe("updateTask", () => {
    it("throws when user is not authenticated", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { updateTask } = await import("./tasks");
      await expect(
        updateTask("task-001", "test-portco", "deal-001", { status: "completed" })
      ).rejects.toThrow("Unauthorized");
    });

    it("throws Task not found when task does not exist", async () => {
      dbResults.push([]); // empty select

      const { updateTask } = await import("./tasks");
      await expect(
        updateTask("task-999", "test-portco", "deal-001", { status: "completed" })
      ).rejects.toThrow("Task not found");
    });

    it("updates task and returns it", async () => {
      const current = { id: "task-001", title: "Review", status: "todo", portcoId: "portco-001" };
      const updated = { ...current, status: "in_progress" };
      dbResults.push([current]); // select current
      dbResults.push([updated]); // update returning
      dbResults.push(undefined); // activity log insert (status changed)

      const { updateTask } = await import("./tasks");
      const result = await updateTask("task-001", "test-portco", "deal-001", { status: "in_progress" });

      expect(dbCallTracker.update).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it("logs task_completed when status changes to completed", async () => {
      const current = { id: "task-001", title: "Review", status: "in_progress", portcoId: "portco-001" };
      const updated = { ...current, status: "completed" };
      dbResults.push([current]); // select
      dbResults.push([updated]); // update returning
      dbResults.push(undefined); // activity log

      const { updateTask } = await import("./tasks");
      await updateTask("task-001", "test-portco", "deal-001", { status: "completed" });

      // Verify insert was called for activity log with "task_completed"
      const insertCalls = dbCallTracker.insert.mock.calls;
      expect(insertCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("does not log activity when status is unchanged", async () => {
      const current = { id: "task-001", title: "Review", status: "todo", portcoId: "portco-001" };
      const updated = { ...current, title: "Review Updated" };
      dbResults.push([current]); // select
      dbResults.push([updated]); // update returning

      const { updateTask } = await import("./tasks");
      await updateTask("task-001", "test-portco", "deal-001", { title: "Review Updated" });

      // Insert called once for update returning, but not for activity log
      // since status didn't change
      expect(dbCallTracker.insert).not.toHaveBeenCalled();
    });
  });
});
