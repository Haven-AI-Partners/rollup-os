import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTasksForDeal } from "@/lib/actions/tasks";
import { TaskList } from "@/components/deals/task-list";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) notFound();

  const tasks = await getTasksForDeal(dealId);

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">Tasks</h2>
      <TaskList
        dealId={dealId}
        portcoId={deal.portcoId}
        portcoSlug={portcoSlug}
        initialTasks={tasks}
      />
    </div>
  );
}
