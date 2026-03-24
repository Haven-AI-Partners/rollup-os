"use server";

import { db } from "@/lib/db";
import { dealFinancials, dealActivityLog } from "@/lib/db/schema";

import { revalidatePath } from "next/cache";
import { requirePortcoRole } from "@/lib/auth";

export async function addFinancialEntry(
  dealId: string,
  portcoId: string,
  portcoSlug: string,
  data: {
    period: string;
    periodType: "monthly" | "quarterly" | "annual" | "snapshot";
    revenue?: string;
    ebitda?: string;
    netIncome?: string;
    ebitdaMarginPct?: string;
  }
) {
  const { user } = await requirePortcoRole(portcoId, "analyst");

  const [entry] = await db
    .insert(dealFinancials)
    .values({
      dealId,
      portcoId,
      period: data.period,
      periodType: data.periodType,
      revenue: data.revenue,
      ebitda: data.ebitda,
      netIncome: data.netIncome,
      ebitdaMarginPct: data.ebitdaMarginPct,
      source: "manual",
    })
    .returning();

  await db.insert(dealActivityLog).values({
    dealId,
    portcoId,
    userId: user.id,
    action: "financial_entry_added",
    description: `Added financial data for ${data.period}`,
  });

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}`);
  return entry;
}
