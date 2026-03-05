import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { portcos, deals, portcoMemberships, users, pipelineStages, dealFinancials } from "@/lib/db/schema";
import { eq, and, sql, count, sum } from "drizzle-orm";
import { getPortcoBySlug } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
  const [pipelineStats, [financialAgg], acquisitions, teamMembers] = await Promise.all([
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
  ]);

  const totalActiveDeals = pipelineStats.reduce((sum, s) => sum + Number(s.dealCount), 0);

  const focusAreas = (portco.focusAreas as string[] | null) ?? [];
  const targetGeo = (portco.targetGeography as string[] | null) ?? [];

  return (
    <div className="space-y-6">
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

      {/* Investment Thesis */}
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

      {/* Pipeline Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          {pipelineStats.length > 0 ? (
            <div className="flex gap-3 flex-wrap">
              {pipelineStats.map((stage) => (
                <div
                  key={stage.stageName}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                >
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: stage.stageColor ?? "#94a3b8" }}
                  />
                  <span className="text-sm font-medium">{stage.stageName}</span>
                  <Badge variant="secondary" className="ml-1">{String(stage.dealCount)}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No pipeline stages configured yet.</p>
          )}
        </CardContent>
      </Card>

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

        {/* Target Criteria & Team */}
        <div className="space-y-6">
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
      </div>
    </div>
  );
}
