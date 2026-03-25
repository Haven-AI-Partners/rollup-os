import { notFound } from "next/navigation";
import { getPortcoBySlug } from "@/lib/auth";
import { getDealsForPortco, getStagesForPortco } from "@/lib/actions/deals";
import { PipelineView } from "@/components/deals/pipeline-view";
import { CreateDealDialog } from "@/components/deals/create-deal-dialog";

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const [allStages, deals] = await Promise.all([
    getStagesForPortco(portco.id),
    getDealsForPortco(portco.id),
  ]);

  // Filter out PMI stages from the kanban — those belong in Portfolio
  const stages = allStages.filter((s) => s.phase !== "pmi");
  const activeDeals = deals.filter((d) => d.status === "active");

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
      <PipelineView
        stages={stages}
        deals={activeDeals}
        portcoSlug={portcoSlug}
      />
    </div>
  );
}
