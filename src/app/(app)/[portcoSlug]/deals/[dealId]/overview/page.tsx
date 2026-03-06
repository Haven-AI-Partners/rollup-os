import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals, dealTasks, dealActivityLog, pipelineStages, companyProfiles, dealRedFlags } from "@/lib/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RedFlagsPanel } from "@/components/deals/red-flags-panel";

export default async function DealOverviewPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) notFound();

  // Task stats
  const taskStats = await db
    .select({
      status: dealTasks.status,
      count: count(),
    })
    .from(dealTasks)
    .where(eq(dealTasks.dealId, dealId))
    .groupBy(dealTasks.status);

  const totalTasks = taskStats.reduce((sum, t) => sum + Number(t.count), 0);
  const completedTasks = taskStats.find((t) => t.status === "completed")?.count ?? 0;

  // Recent activity
  const recentActivity = await db
    .select()
    .from(dealActivityLog)
    .where(eq(dealActivityLog.dealId, dealId))
    .orderBy(sql`${dealActivityLog.createdAt} DESC`)
    .limit(5);

  // Profile
  const [profile] = await db
    .select()
    .from(companyProfiles)
    .where(eq(companyProfiles.dealId, dealId))
    .limit(1);

  // Red flags
  const redFlags = await db
    .select()
    .from(dealRedFlags)
    .where(eq(dealRedFlags.dealId, dealId))
    .orderBy(dealRedFlags.createdAt);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Asking Price</p>
              <p className="text-lg font-bold">
                {deal.askingPrice ? `$${Number(deal.askingPrice).toLocaleString()}` : "--"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-lg font-bold">
                {deal.revenue ? `$${Number(deal.revenue).toLocaleString()}` : "--"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">EBITDA</p>
              <p className="text-lg font-bold">
                {deal.ebitda ? `$${Number(deal.ebitda).toLocaleString()}` : "--"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Employees</p>
              <p className="text-lg font-bold">{deal.employeeCount ?? "--"}</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Profile Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Profile</CardTitle>
            <CardDescription>
              {profile ? "AI-generated from IM analysis" : "Not yet generated"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile ? (
              <div className="space-y-3">
                <p className="text-sm">{profile.summary}</p>
                {profile.aiOverallScore && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Score:</span>
                    <Badge>{Number(profile.aiOverallScore).toFixed(1)}/5</Badge>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Upload an IM document and run the IM Processing Agent to generate a profile.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Red Flags */}
        <RedFlagsPanel
          dealId={dealId}
          portcoId={deal.portcoId}
          portcoSlug={portcoSlug}
          initialFlags={redFlags}
        />

        {/* Task Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-full bg-muted h-2">
                <div
                  className="rounded-full bg-primary h-2 transition-all"
                  style={{
                    width: totalTasks > 0 ? `${(Number(completedTasks) / totalTasks) * 100}%` : "0%",
                  }}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {String(completedTasks)}/{totalTasks}
              </span>
            </div>
            {taskStats.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {taskStats.map((t) => (
                  <Badge key={t.status} variant="outline" className="text-xs capitalize">
                    {t.status}: {String(t.count)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <div key={entry.id} className="flex gap-2">
                    <div className="mt-1 size-2 rounded-full bg-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
