import { notFound } from "next/navigation";
import { getTasksForDeal } from "@/lib/actions/tasks";
import { TaskList } from "@/components/deals/task-list";
import { getDeal } from "@/lib/db/cached-queries";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal, tasks] = await Promise.all([
    getDeal(dealId),
    getTasksForDeal(dealId),
  ]);

  if (!deal) notFound();

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
