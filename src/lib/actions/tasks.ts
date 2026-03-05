"use server";

import { db } from "@/lib/db";
import { dealTasks, dealActivityLog } from "@/lib/db/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

export async function getTasksForDeal(dealId: string) {
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
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [task] = await db
    .insert(dealTasks)
    .values({
      dealId,
      portcoId,
      title: data.title,
      description: data.description,
      category: data.category as any,
      priority: (data.priority as any) ?? "medium",
      assignedTo: data.assignedTo,
      dueDate: data.dueDate,
      parentTaskId: data.parentTaskId,
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

  revalidatePath(`/${portcoSlug}/deals/${dealId}`);
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
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [current] = await db.select().from(dealTasks).where(eq(dealTasks.id, taskId)).limit(1);
  if (!current) throw new Error("Task not found");

  const [updated] = await db
    .update(dealTasks)
    .set({
      ...data,
      status: data.status as any,
      priority: data.priority as any,
      completedAt: data.status === "completed" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(dealTasks.id, taskId))
    .returning();

  if (data.status && data.status !== current.status) {
    await db.insert(dealActivityLog).values({
      dealId,
      portcoId: current.portcoId,
      userId: user.id,
      action: data.status === "completed" ? "task_completed" : "status_changed",
      description:
        data.status === "completed"
          ? `Completed task "${current.title}"`
          : `Task "${current.title}" status changed to "${data.status}"`,
      referenceType: "task",
      referenceId: taskId,
    });
  }

  revalidatePath(`/${portcoSlug}/deals/${dealId}`);
  return updated;
}
