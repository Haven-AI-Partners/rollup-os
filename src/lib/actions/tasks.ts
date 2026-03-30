"use server";

import { db } from "@/lib/db";
import { dealTasks, dealActivityLog } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePortcoRole } from "@/lib/auth";
import { createTaskSchema, updateTaskSchema } from "./schemas";

export async function getTasksForDeal(dealId: string) {
  await requireAuth();
  return db
    .select()
    .from(dealTasks)
    .where(eq(dealTasks.dealId, dealId))
    .orderBy(asc(dealTasks.position));
}

export async function createTask(
  dealId: string,
  portcoId: string,
  portcoSlug: string,
  data: {
    title: string;
    description?: string;
    category: string;
    priority?: string;
    assignedTo?: string;
    dueDate?: string;
    parentTaskId?: string;
  }
) {
  const { user } = await requirePortcoRole(portcoId, "analyst");
  const validated = createTaskSchema.parse(data);

  const [task] = await db
    .insert(dealTasks)
    .values({
      dealId,
      portcoId,
      title: validated.title,
      description: validated.description,
      category: validated.category,
      priority: validated.priority ?? "medium",
      assignedTo: validated.assignedTo,
      dueDate: validated.dueDate,
      parentTaskId: validated.parentTaskId,
    })
    .returning();

  await db.insert(dealActivityLog).values({
    dealId,
    portcoId,
    userId: user.id,
    action: "task_created",
    description: `Created task "${data.title}"`,
    referenceType: "task",
    referenceId: task.id,
  });

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
  return task;
}

export async function updateTask(
  taskId: string,
  portcoSlug: string,
  dealId: string,
  data: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    assignedTo: string;
    dueDate: string;
  }>
) {
  const validated = updateTaskSchema.parse(data);

  const [current] = await db.select().from(dealTasks).where(eq(dealTasks.id, taskId)).limit(1);
  if (!current) throw new Error("Task not found");

  const { user } = await requirePortcoRole(current.portcoId, "analyst");

  const [updated] = await db
    .update(dealTasks)
    .set({
      ...validated,
      completedAt: validated.status === "completed" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(dealTasks.id, taskId))
    .returning();

  if (validated.status && validated.status !== current.status) {
    await db.insert(dealActivityLog).values({
      dealId,
      portcoId: current.portcoId,
      userId: user.id,
      action: validated.status === "completed" ? "task_completed" : "status_changed",
      description:
        validated.status === "completed"
          ? `Completed task "${current.title}"`
          : `Task "${current.title}" status changed to "${validated.status}"`,
      referenceType: "task",
      referenceId: taskId,
    });
  }

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
  return updated;
}
