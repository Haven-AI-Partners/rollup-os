import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  discoverySessions,
  discoveryMessages,
  discoveryWorkflows,
  discoveryCampaigns,
  companyEmployees,
  deals,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bot,
  User,
  Star,
  Clock,
  CheckCircle,
  Activity,
  Workflow,
  AlertTriangle,
  ArrowRight,
  Gauge,
} from "lucide-react";
import Link from "next/link";

const FEEDBACK_TAG_LABELS: Record<string, string> = {
  felt_natural: "自然な会話だった",
  helpful: "役に立った",
  too_many_questions: "質問が多すぎた",
  confusing: "分かりにくかった",
  too_slow: "テンポが遅かった",
  too_fast: "テンポが速かった",
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; sessionId: string }>;
}) {
  const { portcoSlug, sessionId } = await params;
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const user = await getCurrentUser();
  const role = user ? await getUserPortcoRole(user.id, portco.id) : null;
  if (!role || !hasMinRole(role as UserRole, "analyst")) notFound();

  // Load session with employee + campaign + deal
  const [session] = await db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.id, sessionId))
    .limit(1);

  if (!session) notFound();

  const [[employee], [campaign], messages, workflows] = await Promise.all([
    db.select().from(companyEmployees).where(eq(companyEmployees.id, session.employeeId)).limit(1),
    db.select().from(discoveryCampaigns).where(eq(discoveryCampaigns.id, session.campaignId)).limit(1),
    db
      .select({ id: discoveryMessages.id, role: discoveryMessages.role, content: discoveryMessages.content, createdAt: discoveryMessages.createdAt })
      .from(discoveryMessages)
      .where(eq(discoveryMessages.sessionId, sessionId))
      .orderBy(asc(discoveryMessages.createdAt)),
    db
      .select()
      .from(discoveryWorkflows)
      .where(eq(discoveryWorkflows.sessionId, sessionId))
      .orderBy(asc(discoveryWorkflows.createdAt)),
  ]);

  if (!employee || !campaign) notFound();

  // Load deal name (depends on campaign.dealId)
  const [deal] = await db
    .select({ companyName: deals.companyName })
    .from(deals)
    .where(eq(deals.id, campaign.dealId))
    .limit(1);

  const statusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return <Badge className="bg-green-100 text-green-800 border-green-200">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Completed</Badge>;
      case "paused":
        return <Badge variant="secondary">Paused</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "—";
    return date.toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const sentimentScore = session.sentimentScore ? Number(session.sentimentScore) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${portcoSlug}/agents/discovery-interviewer`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{employee.name}</h1>
            {statusBadge(session.status)}
          </div>
          <p className="text-sm text-muted-foreground">
            {[employee.department, employee.jobTitle].filter(Boolean).join(" / ")}
            {deal?.companyName ? ` — ${deal.companyName}` : ""}
          </p>
        </div>
      </div>

      {/* Session Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="size-3" />
            Started
          </div>
          <p className="text-sm font-medium">{formatTime(session.startedAt)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <CheckCircle className="size-3" />
            Completed
          </div>
          <p className="text-sm font-medium">{formatTime(session.completedAt)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Workflow className="size-3" />
            Workflows
          </div>
          <p className="text-sm font-medium">{workflows.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Activity className="size-3" />
            Sentiment
          </div>
          <p className={`text-sm font-medium ${sentimentScore !== null && sentimentScore >= 70 ? "text-green-700" : sentimentScore !== null && sentimentScore < 40 ? "text-red-600" : ""}`}>
            {sentimentScore !== null ? `${sentimentScore}/100` : "—"}
          </p>
        </Card>
      </div>

      {/* Feedback */}
      {session.feedbackRating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee Feedback</CardTitle>
            <CardDescription>
              Submitted {formatTime(session.feedbackAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stars */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`size-5 ${
                    star <= session.feedbackRating!
                      ? "text-amber-400 fill-amber-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
              <span className="ml-2 text-sm font-medium">{session.feedbackRating}/5</span>
            </div>

            {/* Tags */}
            {session.feedbackTags && (session.feedbackTags as string[]).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(session.feedbackTags as string[]).map((tagId) => (
                  <Badge key={tagId} variant="secondary" className="text-xs">
                    {FEEDBACK_TAG_LABELS[tagId] ?? tagId}
                  </Badge>
                ))}
              </div>
            )}

            {/* Comment */}
            {session.feedbackComment && (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm whitespace-pre-wrap">{session.feedbackComment}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extracted Workflows */}
      {workflows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extracted Workflows ({workflows.length})</CardTitle>
            <CardDescription>
              Business processes identified during the interview
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflows.map((wf) => {
              const score = wf.automationScore ? Number(wf.automationScore) : null;
              return (
                <div key={wf.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold">{wf.title}</h4>
                      {wf.shortDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5">{wf.shortDescription}</p>
                      )}
                    </div>
                    {score !== null && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Gauge className="size-4 text-amber-600" />
                        <span className={`text-sm font-semibold ${score >= 70 ? "text-green-700" : score >= 40 ? "text-amber-600" : "text-red-600"}`}>
                          {score}/100
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                    {wf.frequency && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frequency</span>
                        <span>{wf.frequency}</span>
                      </div>
                    )}
                    {wf.timeSpentPerCycle && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time/Cycle</span>
                        <span>{wf.timeSpentPerCycle}</span>
                      </div>
                    )}
                    {wf.volume && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Volume</span>
                        <span>{wf.volume}</span>
                      </div>
                    )}
                    {wf.toolsInvolved && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tools</span>
                        <span className="text-right">{wf.toolsInvolved}</span>
                      </div>
                    )}
                    {wf.trigger && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trigger</span>
                        <span className="text-right">{wf.trigger}</span>
                      </div>
                    )}
                    {wf.peopleInvolved && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">People</span>
                        <span className="text-right">{wf.peopleInvolved}</span>
                      </div>
                    )}
                  </div>

                  {(wf.bottlenecks || wf.errorProneSteps) && (
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-xs">
                      <AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        {wf.bottlenecks && <p><span className="font-medium">Bottlenecks:</span> {wf.bottlenecks}</p>}
                        {wf.errorProneSteps && <p><span className="font-medium">Error-prone:</span> {wf.errorProneSteps}</p>}
                      </div>
                    </div>
                  )}

                  {wf.idealAutomationOutcome && (
                    <div className="flex items-start gap-2 rounded-md bg-green-50 p-2.5 text-xs">
                      <ArrowRight className="size-3.5 text-green-600 shrink-0 mt-0.5" />
                      <p><span className="font-medium">Ideal outcome:</span> {wf.idealAutomationOutcome}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Sentiment Notes */}
      {session.sentimentNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sentiment Analysis</CardTitle>
            <CardDescription>
              AI-assessed employee engagement during the interview
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <div className={`text-2xl font-bold ${sentimentScore !== null && sentimentScore >= 70 ? "text-green-700" : sentimentScore !== null && sentimentScore < 40 ? "text-red-600" : "text-amber-600"}`}>
                {sentimentScore ?? "—"}/100
              </div>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.sentimentNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcript ({messages.length} messages)</CardTitle>
            <CardDescription>
              Full interview conversation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] overflow-y-auto space-y-3 pr-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 size-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="size-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {msg.createdAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 size-7 rounded-full bg-muted flex items-center justify-center">
                      <User className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
