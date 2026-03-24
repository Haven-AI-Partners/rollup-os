"use server";

import { db } from "@/lib/db";
import { dealFinancials, dealActivityLog } from "@/lib/db/schema";

import { revalidatePath } from "next/cache";
import { requirePortcoRole } from "@/lib/auth";
import { addFinancialEntrySchema } from "./schemas";

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
  const validated = addFinancialEntrySchema.parse(data);

  const [entry] = await db
    .insert(dealFinancials)
    .values({
      dealId,
      portcoId,
      period: validated.period,
      periodType: validated.periodType,
      revenue: validated.revenue,
      ebitda: validated.ebitda,
      netIncome: validated.netIncome,
      ebitdaMarginPct: validated.ebitdaMarginPct,
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
