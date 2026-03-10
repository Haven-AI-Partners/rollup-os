import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getPortcoBySlug } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default async function PortfolioCompaniesPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);

  if (!portco) notFound();

  const closedDeals = await db
    .select({
      id: deals.id,
      companyName: deals.companyName,
      industry: deals.industry,
      location: deals.location,
      revenue: deals.revenue,
      ebitda: deals.ebitda,
      askingPrice: deals.askingPrice,
      currency: deals.currency,
      closedAt: deals.closedAt,
    })
    .from(deals)
    .where(
      and(
        eq(deals.portcoId, portco.id),
        eq(deals.status, "closed_won")
      )
    )
    .orderBy(desc(deals.closedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portfolio Companies</h1>
        <p className="text-sm text-muted-foreground">
          {closedDeals.length} acquired {closedDeals.length === 1 ? "company" : "companies"}
        </p>
      </div>

      {closedDeals.length > 0 ? (
        <div className="space-y-3">
          {closedDeals.map((deal) => (
            <Link key={deal.id} href={`/${portcoSlug}/pipeline/${deal.id}/overview`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-md bg-muted p-2">
                    <Building2 className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{deal.companyName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {deal.industry && (
                        <Badge variant="outline" className="text-xs">{deal.industry}</Badge>
                      )}
                      {deal.location && (
                        <span className="text-xs text-muted-foreground">{deal.location}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-right shrink-0">
                    {deal.revenue && (
                      <div>
                        <p className="font-medium">{formatCurrency(deal.revenue, deal.currency)}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    )}
                    {deal.ebitda && (
                      <div>
                        <p className="font-medium">{formatCurrency(deal.ebitda, deal.currency)}</p>
                        <p className="text-xs text-muted-foreground">EBITDA</p>
                      </div>
                    )}
                    {deal.askingPrice && (
                      <div>
                        <p className="font-medium">{formatCurrency(deal.askingPrice, deal.currency)}</p>
                        <p className="text-xs text-muted-foreground">Purchase Price</p>
                      </div>
                    )}
                    {deal.closedAt && (
                      <div>
                        <p className="font-medium">
                          {new Date(deal.closedAt).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">Acquired</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Building2 className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No acquisitions yet. Deals marked as &quot;Closed Won&quot; will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
