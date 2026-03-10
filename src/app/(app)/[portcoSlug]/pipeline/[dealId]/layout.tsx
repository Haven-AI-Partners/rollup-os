import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { deals, pipelineStages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Profile", segment: "profile" },
  { label: "Organization", segment: "organization" },
  { label: "Files", segment: "files" },
  { label: "Tasks", segment: "tasks" },
  { label: "Comments", segment: "comments" },
  { label: "Financials", segment: "financials" },
  { label: "Activity", segment: "activity" },
];

export default async function DealDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) notFound();

  const [stage] = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.id, deal.stageId))
    .limit(1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
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
            {deal.revenue && <span>Rev: ${Number(deal.revenue).toLocaleString()}</span>}
            {deal.ebitda && <span>EBITDA: ${Number(deal.ebitda).toLocaleString()}</span>}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.segment}
            href={`/${portcoSlug}/pipeline/${dealId}/${tab.segment}`}
            className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Tab Content */}
      {children}
    </div>
  );
}
