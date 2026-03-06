import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { portcos, deals, portcoMemberships, users, pipelineStages, dealFinancials, brokerFirms, companyProfiles } from "@/lib/db/schema";
import { eq, and, sql, count, sum, avg, desc, isNotNull } from "drizzle-orm";
import { getPortcoBySlug } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Trophy, TrendingUp, Star } from "lucide-react";
import Link from "next/link";
import { PipelineCharts } from "@/components/dashboard/pipeline-charts";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);

  if (!portco) {
    notFound();
  }

  // Run all independent queries in parallel
  const [pipelineStats, [financialAgg], acquisitions, teamMembers, brokerLeaderboard, stagesList, dealsByMonth] = await Promise.all([
    // Pipeline snapshot
    db
      .select({
        stageName: pipelineStages.name,
        stageColor: pipelineStages.color,
        phase: pipelineStages.phase,
        dealCount: count(deals.id),
      })
      .from(pipelineStages)
      .leftJoin(
        deals,
        and(
          eq(deals.stageId, pipelineStages.id),
          eq(deals.status, "active")
        )
      )
      .where(eq(pipelineStages.portcoId, portco.id))
      .groupBy(pipelineStages.id, pipelineStages.name, pipelineStages.color, pipelineStages.phase, pipelineStages.position)
      .orderBy(pipelineStages.position),

    // Aggregate financials for closed deals
    db
      .select({
        totalRevenue: sum(dealFinancials.revenue),
        totalEbitda: sum(dealFinancials.ebitda),
        totalPurchasePrice: sum(dealFinancials.purchasePrice),
        snapshotCount: count(dealFinancials.id),
      })
      .from(dealFinancials)
      .innerJoin(deals, eq(dealFinancials.dealId, deals.id))
      .where(
        and(
          eq(dealFinancials.portcoId, portco.id),
          eq(deals.status, "closed_won")
        )
      ),

    // Closed acquisitions for leaderboard
    db
      .select({
        dealId: deals.id,
        companyName: deals.companyName,
        industry: deals.industry,
        revenue: deals.revenue,
        ebitda: deals.ebitda,
        closedAt: deals.closedAt,
      })
      .from(deals)
      .where(
        and(
          eq(deals.portcoId, portco.id),
          eq(deals.status, "closed_won")
        )
      )
      .orderBy(sql`${deals.ebitda} DESC NULLS LAST`)
      .limit(10),

    // Team members
    db
      .select({
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: portcoMemberships.role,
      })
      .from(portcoMemberships)
      .innerJoin(users, eq(portcoMemberships.userId, users.id))
      .where(eq(portcoMemberships.portcoId, portco.id)),

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
        avgRevenue: avg(deals.revenue),
      })
      .from(deals)
      .innerJoin(brokerFirms, eq(deals.brokerFirmId, brokerFirms.id))
      .leftJoin(companyProfiles, eq(companyProfiles.dealId, deals.id))
      .where(eq(deals.portcoId, portco.id))
      .groupBy(brokerFirms.id, brokerFirms.name, brokerFirms.region)
      .orderBy(desc(sql`count(${deals.id})`))
      .limit(10),

    // Pipeline stages list (for chart config)
    db
      .select({
        id: pipelineStages.id,
        name: pipelineStages.name,
        color: pipelineStages.color,
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
  ]);

  const totalActiveDeals = pipelineStats.reduce((sum, s) => sum + Number(s.dealCount), 0);

  const focusAreas = (portco.focusAreas as string[] | null) ?? [];
  const targetGeo = (portco.targetGeography as string[] | null) ?? [];

  // Build chart data
  const stageMap = new Map(stagesList.map((s) => [s.id, s]));

  // Monthly stacked data
  const monthMap = new Map<string, Record<string, string | number>>();
  for (const row of dealsByMonth) {
    const month = row.month;
    if (!monthMap.has(month)) {
      monthMap.set(month, { month });
    }
    const entry = monthMap.get(month)!;
    entry[row.stageId] = Number(row.dealCount);
  }
  const monthlyChartData = Array.from(monthMap.values()) as Array<{ month: string; [stageId: string]: string | number }>;

  // Format month labels (YYYY-MM → MMM 'YY)
  for (const entry of monthlyChartData) {
    const [y, m] = (entry.month as string).split("-");
    const date = new Date(Number(y), Number(m) - 1);
    entry.month = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  // Current month data
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentMonthRows = dealsByMonth.filter((r) => r.month === currentMonthKey);
  const currentMonthChartData = stagesList.map((stage) => {
    const row = currentMonthRows.find((r) => r.stageId === stage.id);
    return {
      stageName: stage.name,
      stageColor: stage.color ?? "#94a3b8",
      count: row ? Number(row.dealCount) : 0,
    };
  });

  const chartStages = stagesList.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color ?? "#94a3b8",
  }));

  return (
    <div className="space-y-8">
      {/* Company Identity */}
      <div>
        <h1 className="text-3xl font-bold">{portco.name}</h1>
        {portco.description && (
          <p className="mt-1 text-muted-foreground">{portco.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {portco.industry && <Badge variant="secondary">{portco.industry}</Badge>}
          {focusAreas.map((area) => (
            <Badge key={area} variant="outline">{area}</Badge>
          ))}
        </div>
      </div>

      {/* Strategy & Team */}
      <div className="grid gap-6 lg:grid-cols-3">
        {portco.investmentThesis && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Investment Thesis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{portco.investmentThesis}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Target Criteria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Revenue Range</p>
                <p className="font-medium">
                  {portco.targetRevenueMin || portco.targetRevenueMax
                    ? `$${Number(portco.targetRevenueMin ?? 0).toLocaleString()} - $${Number(portco.targetRevenueMax ?? 0).toLocaleString()}`
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">EBITDA Range</p>
                <p className="font-medium">
                  {portco.targetEbitdaMin || portco.targetEbitdaMax
                    ? `$${Number(portco.targetEbitdaMin ?? 0).toLocaleString()} - $${Number(portco.targetEbitdaMax ?? 0).toLocaleString()}`
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Deal Size</p>
                <p className="font-medium">
                  {portco.targetDealSizeMin || portco.targetDealSizeMax
                    ? `$${Number(portco.targetDealSizeMin ?? 0).toLocaleString()} - $${Number(portco.targetDealSizeMax ?? 0).toLocaleString()}`
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Geography</p>
                <p className="font-medium">
                  {targetGeo.length > 0 ? targetGeo.join(", ") : "Not set"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team</CardTitle>
            <CardDescription>{teamMembers.length} members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div key={member.userId} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{member.fullName ?? member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{member.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aggregate Financials */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Portfolio Revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {financialAgg?.totalRevenue
                ? `$${Number(financialAgg.totalRevenue).toLocaleString()}`
                : "--"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Portfolio EBITDA</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {financialAgg?.totalEbitda
                ? `$${Number(financialAgg.totalEbitda).toLocaleString()}`
                : "--"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Capital Deployed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {financialAgg?.totalPurchasePrice
                ? `$${Number(financialAgg.totalPurchasePrice).toLocaleString()}`
                : "--"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalActiveDeals}</p>
            <p className="text-xs text-muted-foreground">deals in pipeline</p>
          </CardContent>
        </Card>
      </div>

      {/* Deal Flow Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Deal Flow</h2>
          <p className="text-sm text-muted-foreground">Pipeline activity, broker performance, and acquisition history</p>
        </div>

        {/* Pipeline Charts */}
        <PipelineCharts
          stages={chartStages}
          monthlyData={monthlyChartData}
          currentMonthData={currentMonthChartData}
          currentMonthLabel={currentMonthLabel}
        />

        {/* Leaderboards */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Acquisition Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acquisition Leaderboard</CardTitle>
              <CardDescription>Closed acquisitions ranked by EBITDA contribution</CardDescription>
            </CardHeader>
            <CardContent>
              {acquisitions.length > 0 ? (
                <div className="space-y-3">
                  {acquisitions.map((acq, i) => (
                    <div key={acq.dealId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5">
                          {i + 1}.
                        </span>
                        <div>
                          <p className="text-sm font-medium">{acq.companyName}</p>
                          {acq.industry && (
                            <p className="text-xs text-muted-foreground">{acq.industry}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {acq.ebitda && (
                          <p className="text-sm font-medium">
                            ${Number(acq.ebitda).toLocaleString()} EBITDA
                          </p>
                        )}
                        {acq.revenue && (
                          <p className="text-xs text-muted-foreground">
                            ${Number(acq.revenue).toLocaleString()} rev
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No closed acquisitions yet.</p>
              )}
            </CardContent>
          </Card>

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
      </div>
    </div>
  );
}
