import { notFound } from "next/navigation";
import Link from "next/link";
import { getDeal, getStage } from "@/lib/db/cached-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { DealTabs } from "@/components/deals/deal-tabs";
import { DealChat } from "@/components/deals/deal-chat";

export default async function DealDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const deal = await getDeal(dealId);
  if (!deal) notFound();

  const stage = await getStage(deal.stageId);

  return (
    <div>
      {/* Sticky header + tabs */}
      <div className="sticky top-0 z-10 bg-background -mx-6 px-6 pb-0 pt-0 border-b">
        <div className="flex items-start gap-4 pb-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${portcoSlug}/pipeline`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{deal.companyName}</h1>
              <Badge
                style={{ backgroundColor: stage?.color ?? "#94a3b8", color: "white" }}
              >
                {stage?.name ?? "Unknown"}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {deal.status}
              </Badge>
            </div>
            {deal.description && (
              <p className="mt-1 text-sm text-muted-foreground">{deal.description}</p>
            )}
            <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
              {deal.industry && <span>{deal.industry}</span>}
              {deal.location && <span>{deal.location}</span>}
              {deal.revenue && <span>Rev: {formatCurrency(deal.revenue, deal.currency)}</span>}
              {deal.ebitda && <span>EBITDA: {formatCurrency(deal.ebitda, deal.currency)}</span>}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <DealTabs basePath={`/${portcoSlug}/pipeline/${dealId}`} />
      </div>

      {/* Tab Content */}
      <div className="pt-4">
        {children}
      </div>

      <DealChat dealId={dealId} />
    </div>
  );
}
