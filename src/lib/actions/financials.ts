"use server";

import { db } from "@/lib/db";
import { dealFinancials, dealActivityLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

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
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

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
    action: "file_uploaded",
    description: `Added financial data for ${data.period}`,
  });

  revalidatePath(`/${portcoSlug}/deals/${dealId}`);
  return entry;
}
