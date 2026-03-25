import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dealFinancials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialEntryForm } from "@/components/deals/financial-entry-form";
import { formatCurrency } from "@/lib/format";
import { getDeal } from "@/lib/db/cached-queries";

function pct(val: string | null) {
  if (!val) return "—";
  return `${Number(val).toFixed(1)}%`;
}

export default async function FinancialsPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal, financials] = await Promise.all([
    getDeal(dealId),
    db
      .select()
      .from(dealFinancials)
      .where(eq(dealFinancials.dealId, dealId))
      .orderBy(dealFinancials.period),
  ]);

  if (!deal) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Financials</h2>
      </div>

      {/* Snapshot from deal header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Deal Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Asking Price</p>
              <p className="text-sm font-medium">{formatCurrency(deal.askingPrice, deal.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-sm font-medium">{formatCurrency(deal.revenue, deal.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">EBITDA</p>
              <p className="text-sm font-medium">{formatCurrency(deal.ebitda, deal.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Employees</p>
              <p className="text-sm font-medium">
                {deal.employeeCount?.toLocaleString() ?? "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add financial entry */}
      <FinancialEntryForm
        dealId={dealId}
        portcoId={deal.portcoId}
        portcoSlug={portcoSlug}
      />

      {/* Financial periods table */}
      {financials.length > 0 ? (
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Period</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2 text-right font-medium">EBITDA</th>
                  <th className="px-3 py-2 text-right font-medium">Net Income</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                  <th className="px-3 py-2 text-right font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {financials.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{f.period}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {f.periodType}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(f.revenue, deal.currency)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(f.ebitda, deal.currency)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(f.netIncome, deal.currency)}</td>
                    <td className="px-3 py-2 text-right">{pct(f.ebitdaMarginPct)}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {f.source?.replace(/_/g, " ") ?? "manual"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No financial periods recorded yet. Add one above.
        </p>
      )}
    </div>
  );
}
