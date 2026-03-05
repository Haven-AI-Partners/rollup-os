import { notFound } from "next/navigation";
import { getPortcoBySlug } from "@/lib/auth";
import { getDealsForPortco, getStagesForPortco } from "@/lib/actions/deals";
import { KanbanBoard } from "@/components/deals/kanban-board";
import { CreateDealDialog } from "@/components/deals/create-deal-dialog";

export default async function DealsPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const [stages, deals] = await Promise.all([
    getStagesForPortco(portco.id),
    getDealsForPortco(portco.id),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deal Pipeline</h1>
        <CreateDealDialog
          portcoId={portco.id}
          portcoSlug={portcoSlug}
          stages={stages}
        />
      </div>
      <KanbanBoard
        stages={stages}
        initialDeals={deals}
        portcoSlug={portcoSlug}
      />
    </div>
  );
}
