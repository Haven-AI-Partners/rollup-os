import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { portcos, deals, portcoMemberships, users, dealFinancials, pipelineStages } from "@/lib/db/schema";
import { eq, and, sql, count, sum, desc } from "drizzle-orm";
import { getPortcoBySlug } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

export default async function PortfolioOverviewPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);

  if (!portco) {
    notFound();
  }

  const [[financialAgg], teamMembers, pipelineStats] = await Promise.all([
    // Aggregate financials for closed deals
    db
      .select({
        totalRevenue: sum(dealFinancials.revenue),
        totalEbitda: sum(dealFinancials.ebitda),
        totalPurchasePrice: sum(dealFinancials.purchasePrice),
      })
      .from(dealFinancials)
      .innerJoin(deals, eq(dealFinancials.dealId, deals.id))
      .where(
        and(
          eq(dealFinancials.portcoId, portco.id),
          eq(deals.status, "closed_won")
        )
      ),

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

    // Pipeline snapshot for active deal count
    db
      .select({
        dealCount: count(deals.id),
      })
      .from(deals)
      .where(and(eq(deals.portcoId, portco.id), eq(deals.status, "active"))),
  ]);

  const totalActiveDeals = pipelineStats[0]?.dealCount ?? 0;
  const focusAreas = (portco.focusAreas as string[] | null) ?? [];
  const targetGeo = (portco.targetGeography as string[] | null) ?? [];

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
                    ? `${formatCurrency(portco.targetRevenueMin ?? 0)} - ${formatCurrency(portco.targetRevenueMax ?? 0)}`
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">EBITDA Range</p>
                <p className="font-medium">
                  {portco.targetEbitdaMin || portco.targetEbitdaMax
                    ? `${formatCurrency(portco.targetEbitdaMin ?? 0)} - ${formatCurrency(portco.targetEbitdaMax ?? 0)}`
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Deal Size</p>
                <p className="font-medium">
                  {portco.targetDealSizeMin || portco.targetDealSizeMax
                    ? `${formatCurrency(portco.targetDealSizeMin ?? 0)} - ${formatCurrency(portco.targetDealSizeMax ?? 0)}`
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
                ? formatCurrency(financialAgg.totalRevenue)
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
                ? formatCurrency(financialAgg.totalEbitda)
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
                ? formatCurrency(financialAgg.totalPurchasePrice)
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
    </div>
  );
}
