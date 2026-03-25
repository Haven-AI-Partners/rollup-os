import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getPortcoBySlug } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function PortfolioAnalyticsPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const acquisitions = await db
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
    .limit(10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Portfolio Analytics</h1>
        <p className="text-sm text-muted-foreground">Acquisition performance and portfolio insights</p>
      </div>

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
                <Link
                  key={acq.dealId}
                  href={`/${portcoSlug}/pipeline/${acq.dealId}/overview`}
                  className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1.5 -mx-2 transition-colors"
                >
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
                  <div className="flex items-center gap-4 text-right">
                    {acq.ebitda && (
                      <div>
                        <p className="text-sm font-medium">
                          ${Number(acq.ebitda).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">EBITDA</p>
                      </div>
                    )}
                    {acq.revenue && (
                      <div className="hidden sm:block">
                        <p className="text-sm font-medium">
                          ${Number(acq.revenue).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Revenue</p>
                      </div>
                    )}
                    {acq.closedAt && (
                      <div className="hidden sm:block">
                        <p className="text-sm font-medium">
                          {new Date(acq.closedAt).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Acquired</p>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No closed acquisitions yet. Deals marked as &quot;Closed Won&quot; will appear here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
