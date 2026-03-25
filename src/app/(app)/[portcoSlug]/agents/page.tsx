import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { files, deals, companyProfiles, discoveryCampaigns, discoverySessions, discoveryWorkflows, dealThesisNodes } from "@/lib/db/schema";
import { eq, count, avg, sql, desc } from "drizzle-orm";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  MessageSquare,
  FileText,
  Users,
  Workflow,
  Star,
  ArrowRight,
  TreePine,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const user = await getCurrentUser();
  const role = user ? await getUserPortcoRole(user.id, portco.id) : null;
  const isAdmin = role ? hasMinRole(role as UserRole, "admin") : false;

  // Fetch stats for both agents in parallel
  const [
    imStatusCounts,
    imAvgScore,
    campaignCount,
    sessionCount,
    workflowCount,
    avgAutomationScore,
    thesisTreeCount,
    thesisNodeStats,
  ] = await Promise.all([
    // IM Processor stats
    db
      .select({
        status: files.processingStatus,
        count: count(files.id),
      })
      .from(files)
      .where(eq(files.portcoId, portco.id))
      .groupBy(files.processingStatus),

    db
      .select({ avg: avg(companyProfiles.aiOverallScore) })
      .from(companyProfiles)
      .innerJoin(deals, eq(companyProfiles.dealId, deals.id))
      .where(eq(deals.portcoId, portco.id)),

    // Discovery Interviewer stats
    db
      .select({ count: count(discoveryCampaigns.id) })
      .from(discoveryCampaigns)
      .where(eq(discoveryCampaigns.portcoId, portco.id)),

    db
      .select({ count: count(discoverySessions.id) })
      .from(discoverySessions)
      .innerJoin(discoveryCampaigns, eq(discoverySessions.campaignId, discoveryCampaigns.id))
      .where(eq(discoveryCampaigns.portcoId, portco.id)),

    db
      .select({ count: count(discoveryWorkflows.id) })
      .from(discoveryWorkflows)
      .innerJoin(discoveryCampaigns, eq(discoveryWorkflows.campaignId, discoveryCampaigns.id))
      .where(eq(discoveryCampaigns.portcoId, portco.id)),

    db
      .select({ avg: avg(discoveryWorkflows.automationScore) })
      .from(discoveryWorkflows)
      .innerJoin(discoveryCampaigns, eq(discoveryWorkflows.campaignId, discoveryCampaigns.id))
      .where(eq(discoveryCampaigns.portcoId, portco.id)),

    // Thesis Generator stats
    db
      .select({ count: sql<number>`count(distinct ${dealThesisNodes.dealId})` })
      .from(dealThesisNodes)
      .where(eq(dealThesisNodes.portcoId, portco.id)),

    db
      .select({
        total: count(dealThesisNodes.id),
        complete: sql<number>`count(*) filter (where ${dealThesisNodes.status} = 'complete')`,
        risk: sql<number>`count(*) filter (where ${dealThesisNodes.status} = 'risk')`,
      })
      .from(dealThesisNodes)
      .where(eq(dealThesisNodes.portcoId, portco.id)),
  ]);

  // IM Processor summary
  const imStatusMap = new Map(imStatusCounts.map((s) => [s.status, Number(s.count)]));
  const imCompleted = imStatusMap.get("completed") ?? 0;
  const imTotal = [...imStatusMap.values()].reduce((a, b) => a + b, 0);
  const imAvg = imAvgScore[0]?.avg ? Number(imAvgScore[0].avg) : null;

  // Discovery summary
  const discCampaigns = Number(campaignCount[0]?.count ?? 0);
  const discSessions = Number(sessionCount[0]?.count ?? 0);
  const discWorkflows = Number(workflowCount[0]?.count ?? 0);
  const discAvg = avgAutomationScore[0]?.avg ? Number(avgAutomationScore[0].avg) : null;

  // Thesis summary
  const thesisTrees = Number(thesisTreeCount[0]?.count ?? 0);
  const thesisTotal = Number(thesisNodeStats[0]?.total ?? 0);
  const thesisComplete = Number(thesisNodeStats[0]?.complete ?? 0);
  const thesisRisk = Number(thesisNodeStats[0]?.risk ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agents</h1>
        <p className="text-sm text-muted-foreground">
          AI agents that automate deal sourcing, evaluation, and post-merger integration
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* IM Processor Card */}
        <Link href={`/${portcoSlug}/agents/im-processor`}>
          <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30 cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-2.5">
                    <Brain className="size-5 text-purple-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">IM Processor</CardTitle>
                    <CardDescription className="line-clamp-2">
                      Analyzes Information Memorandum PDFs to extract profiles, score deals, and flag risks
                    </CardDescription>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="size-3" />
                  {imCompleted}/{imTotal} processed
                </span>
                {imAvg && (
                  <span className="flex items-center gap-1">
                    <Star className="size-3 text-amber-500 fill-amber-500" />
                    {imAvg.toFixed(1)}/5 avg
                  </span>
                )}
              </div>
              <div className="mt-3">
                <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Discovery Interviewer Card */}
        <Link href={`/${portcoSlug}/agents/discovery-interviewer`}>
          <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30 cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2.5">
                    <MessageSquare className="size-5 text-blue-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Taro — Discovery Interviewer</CardTitle>
                    <CardDescription className="line-clamp-2">
                      AI-powered employee interviews to map workflows and identify automation opportunities
                    </CardDescription>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  {discCampaigns} campaigns
                </span>
                <span className="flex items-center gap-1">
                  <Users className="size-3" />
                  {discSessions} sessions
                </span>
                <span className="flex items-center gap-1">
                  <Workflow className="size-3" />
                  {discWorkflows} workflows
                </span>
              </div>
              <div className="mt-3">
                <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* DD Thesis Generator Card */}
        <Link href={`/${portcoSlug}/agents/thesis-generator`}>
          <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30 cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2.5">
                    <TreePine className="size-5 text-emerald-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">DD Thesis Generator</CardTitle>
                    <CardDescription className="line-clamp-2">
                      Generates per-deal due diligence trees to track information coverage and identify blind spots
                    </CardDescription>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TreePine className="size-3" />
                  {thesisTrees} trees
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="size-3 text-green-600" />
                  {thesisComplete} complete
                </span>
                {thesisRisk > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="size-3" />
                    {thesisRisk} risks
                  </span>
                )}
              </div>
              <div className="mt-3">
                <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
