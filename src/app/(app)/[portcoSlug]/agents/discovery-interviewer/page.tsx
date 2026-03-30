import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  discoveryCampaigns,
  discoverySessions,
  discoveryWorkflows,
  companyEmployees,
  deals,
} from "@/lib/db/schema";
import { eq, count, desc, sql, avg } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
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
import { AgentPageHeader } from "@/components/agents/agent-page-header";
import { AgentConfigCard } from "@/components/agents/agent-config-card";
import { getAgentPageAuth, getPromptVersionsForAgent } from "@/lib/agents/page-helpers";
import { AGENT_SLUG, DEFAULT_TEMPLATE, renderTemplate } from "@/lib/agents/discovery-interviewer/prompt";

export default async function DiscoveryInterviewerPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const { portco, isAnalyst, isAdmin } = await getAgentPageAuth(portcoSlug);
  if (!isAnalyst) notFound();

  const [campaigns, promptData] = await Promise.all([
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

    getPromptVersionsForAgent(AGENT_SLUG, DEFAULT_TEMPLATE, renderTemplate),
  ]);

  // Load aggregate stats across all campaigns
  const campaignIds = campaigns.map((c) => c.id);

  let totalSessions = 0;
  let completedSessions = 0;
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
      <AgentPageHeader
        portcoSlug={portcoSlug}
        title="Taro — Discovery Interviewer"
        description="AI-powered employee interviews to map workflows and identify automation opportunities"
      />

      <AgentConfigCard
        items={[
          { label: "Model", value: "gemini-2.5-flash", mono: true },
          { label: "Language", value: "Japanese (Keigo)" },
          { label: "Agent Name", value: "太郎 (Taro)" },
          { label: "Interview Phases", value: "4 (rapport, discovery, deps, wrap-up)" },
          { label: "Tools", value: "save_workflow, save_dependency, update_sentiment" },
          { label: "Scoring", value: "Deterministic 0-100 (7 factors)" },
        ]}
        badges={
          <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
        }
      />

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
        currentTemplate={promptData.currentTemplate}
        defaultTemplate={DEFAULT_TEMPLATE}
        renderedPrompt={promptData.renderedPrompt}
        versions={promptData.versionsForClient}
        isAdmin={isAdmin}
        title="System Prompt"
        description="The interviewer instructions sent to the AI model. Use {{AGENT_NAME}}, {{EMPLOYEE_NAME}}, {{COMPANY_NAME}}, {{CAMPAIGN_DESCRIPTION}} as dynamic placeholders."
      />
    </div>
  );
}
