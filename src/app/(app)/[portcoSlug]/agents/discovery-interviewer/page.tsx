import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  discoveryCampaigns,
  discoverySessions,
  discoveryWorkflows,
  companyEmployees,
  deals,
} from "@/lib/db/schema";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, count, desc, sql, avg } from "drizzle-orm";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Workflow,
  Activity,
  Clock,
  CheckCircle,
  Pause,
  ExternalLink,
  Star,
} from "lucide-react";
import Link from "next/link";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AGENT_SLUG, DEFAULT_TEMPLATE, renderTemplate } from "@/lib/agents/discovery-interviewer/prompt";

export default async function DiscoveryInterviewerPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const user = await getCurrentUser();
  const role = user ? await getUserPortcoRole(user.id, portco.id) : null;
  const isAdmin = role ? hasMinRole(role as UserRole, "analyst") : false;
  if (!isAdmin) notFound();

  const isOwnerOrAdmin = role ? hasMinRole(role as UserRole, "admin") : false;

  // Load campaigns and prompt versions in parallel
  const [campaigns, versions] = await Promise.all([
    db
      .select({
        id: discoveryCampaigns.id,
        name: discoveryCampaigns.name,
        description: discoveryCampaigns.description,
        status: discoveryCampaigns.status,
        dealId: discoveryCampaigns.dealId,
        companyName: deals.companyName,
        createdAt: discoveryCampaigns.createdAt,
      })
      .from(discoveryCampaigns)
      .innerJoin(deals, eq(discoveryCampaigns.dealId, deals.id))
      .where(eq(discoveryCampaigns.portcoId, portco.id))
      .orderBy(desc(discoveryCampaigns.createdAt)),

    db
      .select({
        id: promptVersions.id,
        version: promptVersions.version,
        template: promptVersions.template,
        isActive: promptVersions.isActive,
        changeNote: promptVersions.changeNote,
        createdAt: promptVersions.createdAt,
      })
      .from(promptVersions)
      .where(eq(promptVersions.agentSlug, AGENT_SLUG))
      .orderBy(desc(promptVersions.version)),
  ]);

  // Determine active template
  const activeVersion = versions.find((v) => v.isActive);
  const currentTemplate = activeVersion?.template ?? DEFAULT_TEMPLATE;
  const renderedPrompt = renderTemplate(currentTemplate);

  const versionsForClient = versions.map((v) => ({
    id: v.id,
    version: v.version,
    template: v.template,
    isActive: v.isActive,
    changeNote: v.changeNote,
    createdAt: v.createdAt.toISOString(),
  }));

  // Load aggregate stats across all campaigns
  const campaignIds = campaigns.map((c) => c.id);

  let totalSessions = 0;
  let completedSessions = 0;
  let inProgressSessions = 0;
  let totalWorkflows = 0;
  let avgAutomationScore: number | null = null;
  let avgFeedbackRating: number | null = null;
  type SessionRow = {
    id: string;
    campaignId: string;
    status: string;
    employeeName: string;
    department: string | null;
    jobTitle: string | null;
    workflowCount: number;
    sentimentScore: string | null;
    feedbackRating: number | null;
    lastActiveAt: Date | null;
    startedAt: Date | null;
  };
  let sessions: SessionRow[] = [];

  if (campaignIds.length > 0) {
    const [sessionStats, workflowStats, scoreStats, feedbackStats, sessionRows] = await Promise.all([
      db
        .select({
          status: discoverySessions.status,
          count: count(discoverySessions.id),
        })
        .from(discoverySessions)
        .where(sql`${discoverySessions.campaignId} IN ${campaignIds}`)
        .groupBy(discoverySessions.status),

      db
        .select({ count: count(discoveryWorkflows.id) })
        .from(discoveryWorkflows)
        .where(sql`${discoveryWorkflows.campaignId} IN ${campaignIds}`),

      db
        .select({ avg: avg(discoveryWorkflows.automationScore) })
        .from(discoveryWorkflows)
        .where(sql`${discoveryWorkflows.campaignId} IN ${campaignIds}`),

      db
        .select({ avg: avg(sql`${discoverySessions.feedbackRating}`) })
        .from(discoverySessions)
        .where(sql`${discoverySessions.campaignId} IN ${campaignIds} AND ${discoverySessions.feedbackRating} IS NOT NULL`),

      db
        .select({
          id: discoverySessions.id,
          campaignId: discoverySessions.campaignId,
          status: discoverySessions.status,
          employeeName: companyEmployees.name,
          department: companyEmployees.department,
          jobTitle: companyEmployees.jobTitle,
          workflowCount: discoverySessions.workflowCount,
          sentimentScore: discoverySessions.sentimentScore,
          feedbackRating: discoverySessions.feedbackRating,
          lastActiveAt: discoverySessions.lastActiveAt,
          startedAt: discoverySessions.startedAt,
        })
        .from(discoverySessions)
        .innerJoin(companyEmployees, eq(discoverySessions.employeeId, companyEmployees.id))
        .where(sql`${discoverySessions.campaignId} IN ${campaignIds}`)
        .orderBy(desc(discoverySessions.lastActiveAt)),
    ]);

    const statusMap = new Map(sessionStats.map((s) => [s.status, Number(s.count)]));
    totalSessions = [...statusMap.values()].reduce((a, b) => a + b, 0);
    completedSessions = statusMap.get("completed") ?? 0;
    inProgressSessions = (statusMap.get("in_progress") ?? 0) + (statusMap.get("pending") ?? 0);
    totalWorkflows = Number(workflowStats[0]?.count ?? 0);
    avgAutomationScore = scoreStats[0]?.avg ? Number(scoreStats[0].avg) : null;
    avgFeedbackRating = feedbackStats[0]?.avg ? Number(feedbackStats[0].avg) : null;
    sessions = sessionRows;
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "in_progress":
        return <Badge className="bg-green-100 text-green-800 border-green-200">{status === "active" ? "Active" : "In Progress"}</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Completed</Badge>;
      case "paused":
        return <Badge variant="secondary">Paused</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${portcoSlug}/agents`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Taro — Discovery Interviewer</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered employee interviews to map workflows and identify automation opportunities
          </p>
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Configuration</CardTitle>
            <Badge className="bg-green-100 text-green-800 border-green-200">
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model</span>
              <span className="font-mono">gemini-2.5-flash</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Language</span>
              <span>Japanese (Keigo)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agent Name</span>
              <span>太郎 (Taro)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interview Phases</span>
              <span>4 (rapport, discovery, deps, wrap-up)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tools</span>
              <span>save_workflow, save_dependency, update_sentiment</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scoring</span>
              <span>Deterministic 0-100 (7 factors)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <MessageSquare className="size-5 text-blue-700" />
            </div>
            <div>
              <CardTitle className="text-base">Interview Stats</CardTitle>
              <CardDescription>
                Campaign and session activity overview
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="size-3" />
                Campaigns
              </div>
              <p className="mt-1 text-2xl font-semibold">{campaigns.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3" />
                Sessions
              </div>
              <p className="mt-1 text-2xl font-semibold">{totalSessions}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle className="size-3" />
                Completed
              </div>
              <p className="mt-1 text-2xl font-semibold text-green-700">{completedSessions}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Workflow className="size-3" />
                Workflows
              </div>
              <p className="mt-1 text-2xl font-semibold">{totalWorkflows}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Activity className="size-3" />
                Automation
              </div>
              <p className="mt-1 text-2xl font-semibold text-amber-600">
                {avgAutomationScore ? `${avgAutomationScore.toFixed(0)}/100` : "—"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Star className="size-3" />
                Feedback
              </div>
              <p className="mt-1 text-2xl font-semibold text-amber-600">
                {avgFeedbackRating ? `${avgFeedbackRating.toFixed(1)}/5` : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns */}
      {campaigns.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Campaigns</h2>
          {campaigns.map((campaign) => {
            const campaignSessions = sessions.filter((s) => s.campaignId === campaign.id);
            return (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      <CardDescription>
                        {campaign.companyName}
                        {campaign.description ? ` — ${campaign.description}` : ""}
                      </CardDescription>
                    </div>
                    {statusBadge(campaign.status)}
                  </div>
                </CardHeader>
                {campaignSessions.length > 0 && (
                  <CardContent>
                    <h4 className="text-sm font-medium mb-2">Interview Sessions</h4>
                    <div className="space-y-1.5">
                      {campaignSessions.map((session) => (
                        <Link
                          key={session.id}
                          href={`/${portcoSlug}/agents/discovery-interviewer/sessions/${session.id}`}
                          className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {session.status === "completed" ? (
                              <CheckCircle className="size-4 text-green-600 shrink-0" />
                            ) : session.status === "in_progress" ? (
                              <Activity className="size-4 text-blue-600 shrink-0" />
                            ) : session.status === "paused" ? (
                              <Pause className="size-4 text-amber-600 shrink-0" />
                            ) : (
                              <Clock className="size-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {session.employeeName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {[session.department, session.jobTitle].filter(Boolean).join(" / ") || "—"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 ml-4">
                            <span className="text-xs text-muted-foreground">
                              {session.workflowCount} workflows
                            </span>
                            {session.feedbackRating && (
                              <span className="flex items-center gap-0.5 text-xs">
                                <Star className="size-3 text-amber-500 fill-amber-500" />
                                {session.feedbackRating}/5
                              </span>
                            )}
                            {session.status === "in_progress" && (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/interview/${session.id}`} target="_blank">
                                  <ExternalLink className="size-3 mr-1" />
                                  Open
                                </Link>
                              </Button>
                            )}
                            {statusBadge(session.status)}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8">
            <MessageSquare className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No discovery campaigns yet. Create one to start interviewing employees.
            </p>
          </CardContent>
        </Card>
      )}

      {/* System Prompt */}
      <PromptEditor
        portcoSlug={portcoSlug}
        agentSlug={AGENT_SLUG}
        currentTemplate={currentTemplate}
        defaultTemplate={DEFAULT_TEMPLATE}
        renderedPrompt={renderedPrompt}
        versions={versionsForClient}
        isAdmin={isOwnerOrAdmin}
        title="System Prompt"
        description="The interviewer instructions sent to the AI model. Use {{AGENT_NAME}}, {{EMPLOYEE_NAME}}, {{COMPANY_NAME}}, {{CAMPAIGN_DESCRIPTION}} as dynamic placeholders."
      />
    </div>
  );
}
