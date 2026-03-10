import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals, pipelineStages, brokerFirms, companyProfiles } from "@/lib/db/schema";
import { eq, and, sql, count, avg, desc } from "drizzle-orm";
import { getPortcoBySlug } from "@/lib/auth";
import { PipelineCharts } from "@/components/dashboard/pipeline-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Trophy, Star } from "lucide-react";
import Link from "next/link";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const [stagesList, dealsByMonth, brokerLeaderboard] = await Promise.all([
    // Pipeline stages list
    db
      .select({
        id: pipelineStages.id,
        name: pipelineStages.name,
        color: pipelineStages.color,
        phase: pipelineStages.phase,
        position: pipelineStages.position,
      })
      .from(pipelineStages)
      .where(eq(pipelineStages.portcoId, portco.id))
      .orderBy(pipelineStages.position),

    // Deals by month and stage (last 12 months)
    db
      .select({
        month: sql<string>`to_char(${deals.createdAt}, 'YYYY-MM')`,
        stageId: deals.stageId,
        dealCount: count(deals.id),
      })
      .from(deals)
      .where(
        and(
          eq(deals.portcoId, portco.id),
          eq(deals.status, "active"),
          sql`${deals.createdAt} >= now() - interval '12 months'`
        )
      )
      .groupBy(sql`to_char(${deals.createdAt}, 'YYYY-MM')`, deals.stageId)
      .orderBy(sql`to_char(${deals.createdAt}, 'YYYY-MM')`),

    // Broker leaderboard
    db
      .select({
        firmId: brokerFirms.id,
        firmName: brokerFirms.name,
        region: brokerFirms.region,
        dealCount: count(deals.id),
        activeDeals: sql<number>`count(*) filter (where ${deals.status} = 'active')`,
        wonDeals: sql<number>`count(*) filter (where ${deals.status} = 'closed_won')`,
        avgScore: avg(companyProfiles.aiOverallScore),
      })
      .from(deals)
      .innerJoin(brokerFirms, eq(deals.brokerFirmId, brokerFirms.id))
      .leftJoin(companyProfiles, eq(companyProfiles.dealId, deals.id))
      .where(eq(deals.portcoId, portco.id))
      .groupBy(brokerFirms.id, brokerFirms.name, brokerFirms.region)
      .orderBy(desc(sql`count(${deals.id})`))
      .limit(10),
  ]);

  // Build chart data (exclude PMI stages)
  const activeStagesList = stagesList.filter((s) => s.phase !== "pmi");

  // Map stageId -> position for cumulative funnel logic
  const stagePositionMap = new Map(stagesList.map((s) => [s.id, s.position]));

  // Monthly stacked bar: each deal counts once at its current stage
  const monthMap = new Map<string, Record<string, string | number>>();
  for (const row of dealsByMonth) {
    if (!activeStagesList.some((s) => s.id === row.stageId)) continue;
    const month = row.month;
    if (!monthMap.has(month)) {
      monthMap.set(month, { month });
    }
    const entry = monthMap.get(month)!;
    entry[row.stageId] = Number(row.dealCount);
  }
  const monthlyChartData = Array.from(monthMap.values()) as Array<{ month: string; [stageId: string]: string | number }>;

  for (const entry of monthlyChartData) {
    const [y, m] = (entry.month as string).split("-");
    const date = new Date(Number(y), Number(m) - 1);
    entry.month = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentMonthRows = dealsByMonth.filter((r) => r.month === currentMonthKey);

  // Current month funnel: cumulative — a deal at stage N counts toward all stages <= N
  const currentMonthChartData = activeStagesList.map((stage) => {
    let cumulativeCount = 0;
    for (const row of currentMonthRows) {
      const dealPosition = stagePositionMap.get(row.stageId);
      if (dealPosition !== undefined && dealPosition >= stage.position) {
        cumulativeCount += Number(row.dealCount);
      }
    }
    return {
      stageName: stage.name,
      stageColor: stage.color ?? "#94a3b8",
      count: cumulativeCount,
    };
  });

  const chartStages = activeStagesList.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color ?? "#94a3b8",
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Deal Flow Analytics</h1>
        <p className="text-sm text-muted-foreground">Pipeline activity and broker performance</p>
      </div>

      {/* Pipeline Charts */}
      <PipelineCharts
        stages={chartStages}
        monthlyData={monthlyChartData}
        currentMonthData={currentMonthChartData}
        currentMonthLabel={currentMonthLabel}
      />

      {/* Broker Leaderboard */}
      <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="size-4" />
              Broker Leaderboard
            </CardTitle>
            <CardDescription>Ranked by deal volume and quality score</CardDescription>
          </CardHeader>
          <CardContent>
            {brokerLeaderboard.length > 0 ? (
              <div className="space-y-3">
                {brokerLeaderboard.map((broker, i) => {
                  const score = broker.avgScore ? Number(broker.avgScore).toFixed(1) : null;
                  return (
                    <Link
                      key={broker.firmId}
                      href={`/${portcoSlug}/brokers/${broker.firmId}`}
                      className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1.5 -mx-2 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5">
                          {i + 1}.
                        </span>
                        <div className="rounded-md bg-muted p-1.5">
                          <Building2 className="size-3 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{broker.firmName}</p>
                          {broker.region && (
                            <p className="text-xs text-muted-foreground">{broker.region}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-sm font-medium">{String(broker.dealCount)}</p>
                          <p className="text-[10px] text-muted-foreground">deals</p>
                        </div>
                        {Number(broker.wonDeals) > 0 && (
                          <div>
                            <p className="text-sm font-medium text-green-600">{String(broker.wonDeals)}</p>
                            <p className="text-[10px] text-muted-foreground">won</p>
                          </div>
                        )}
                        {score && (
                          <div>
                            <p className="text-sm font-medium flex items-center gap-0.5">
                              <Star className="size-3 text-yellow-500 fill-yellow-500" />
                              {score}
                            </p>
                            <p className="text-[10px] text-muted-foreground">avg score</p>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No deals linked to brokers yet. Assign a broker when creating deals to track performance.
              </p>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
