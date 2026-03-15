import { db } from "@/lib/db";
import { discoverySessions, companyEmployees, discoveryCampaigns, deals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { InterviewPage } from "./interview-page";

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const [session] = await db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.id, sessionId))
    .limit(1);

  if (!session) notFound();

  const [[employee], [campaign]] = await Promise.all([
    db.select().from(companyEmployees).where(eq(companyEmployees.id, session.employeeId)).limit(1),
    db.select().from(discoveryCampaigns).where(eq(discoveryCampaigns.id, session.campaignId)).limit(1),
  ]);

  if (!employee || !campaign) notFound();

  // Fetch deal name (depends on campaign.dealId from above)
  const [deal] = await db
    .select({ companyName: deals.companyName })
    .from(deals)
    .where(eq(deals.id, campaign.dealId))
    .limit(1);

  return (
    <InterviewPage
      sessionId={sessionId}
      sessionStatus={session.status}
      employeeName={employee.name}
      companyName={deal?.companyName ?? "会社"}
    />
  );
}
