import { db } from "@/lib/db";
import { files, deals, companyProfiles, evalRuns } from "@/lib/db/schema";
import { eq, and, count, desc, avg } from "drizzle-orm";
import { MODEL_ID } from "@/lib/agents/im-processor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Star,
} from "lucide-react";
import Link from "next/link";
import { EvalPanel } from "@/components/agents/eval-panel";
import { PromptTabs } from "@/components/agents/prompt-tabs";
import { AgentPageHeader } from "@/components/agents/agent-page-header";
import { AgentConfigCard } from "@/components/agents/agent-config-card";
import { getAgentPageAuth, getPromptVersionsForAgent } from "@/lib/agents/page-helpers";
import {
  ANALYZER_EXTRACTION_TEMPLATE,
  ANALYZER_SCORING_TEMPLATE,
} from "@/lib/agents/im-processor/prompts/analyzer";
import {
  AGENT_SLUG,
  EXTRACTION_SLUG,
  SCORING_SLUG,
  renderTemplate,
} from "@/lib/agents/im-processor/prompts/shared";

export default async function IMProcessorPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const { portco, isAdmin } = await getAgentPageAuth(portcoSlug);

  const [statusCounts, recentFiles, scoreStats, extractionData, scoringData, legacyData, processedFiles, recentEvals] = await Promise.all([
    db
      .select({
        status: files.processingStatus,
        count: count(files.id),
      })
      .from(files)
      .where(eq(files.portcoId, portco.id))
      .groupBy(files.processingStatus),

    db
      .select({
        fileId: files.id,
        fileName: files.fileName,
        status: files.processingStatus,
        processedAt: files.processedAt,
        dealId: files.dealId,
        companyName: deals.companyName,
        aiScore: companyProfiles.aiOverallScore,
      })
      .from(files)
      .innerJoin(deals, eq(files.dealId, deals.id))
      .leftJoin(companyProfiles, eq(companyProfiles.dealId, deals.id))
      .where(eq(files.portcoId, portco.id))
      .orderBy(desc(files.updatedAt))
      .limit(3),

    db
      .select({
        avgScore: avg(companyProfiles.aiOverallScore),
      })
      .from(companyProfiles)
      .innerJoin(deals, eq(companyProfiles.dealId, deals.id))
      .where(eq(deals.portcoId, portco.id)),

    getPromptVersionsForAgent(EXTRACTION_SLUG, ANALYZER_EXTRACTION_TEMPLATE, renderTemplate),
    getPromptVersionsForAgent(SCORING_SLUG, ANALYZER_SCORING_TEMPLATE, renderTemplate),
    getPromptVersionsForAgent(AGENT_SLUG, ""),

    db
      .select({
        id: files.id,
        fileName: files.fileName,
        dealId: files.dealId,
        companyName: deals.companyName,
      })
      .from(files)
      .innerJoin(deals, eq(files.dealId, deals.id))
      .where(and(eq(files.portcoId, portco.id), eq(files.processingStatus, "completed")))
      .orderBy(desc(files.processedAt)),

    db
      .select({
        id: evalRuns.id,
        fileName: evalRuns.fileName,
        iterations: evalRuns.iterations,
        status: evalRuns.status,
        overallScoreStdDev: evalRuns.overallScoreStdDev,
        flagAgreementRate: evalRuns.flagAgreementRate,
        nameConsistent: evalRuns.nameConsistent,
        scoreVariance: evalRuns.scoreVariance,
        promptVersionLabel: evalRuns.promptVersionLabel,
        modelId: evalRuns.modelId,
        createdAt: evalRuns.createdAt,
        completedAt: evalRuns.completedAt,
      })
      .from(evalRuns)
      .where(eq(evalRuns.agentSlug, AGENT_SLUG))
      .orderBy(desc(evalRuns.createdAt))
      .limit(10),
  ]);

  const statusMap = new Map(statusCounts.map((s) => [s.status, Number(s.count)]));
  const completed = statusMap.get("completed") ?? 0;
  const failed = statusMap.get("failed") ?? 0;
  const processing = statusMap.get("processing") ?? 0;
  const pending = statusMap.get("pending") ?? 0;
  const total = completed + failed + processing + pending;
  const avgScore = scoreStats[0]?.avgScore ? Number(scoreStats[0].avgScore) : null;

  return (
    <div className="space-y-6">
      <AgentPageHeader
        portcoSlug={portcoSlug}
        title="IM Processor"
        description="Analyzes Information Memorandum PDFs with AI to extract company profiles, score deals, and flag risks"
      />

      <AgentConfigCard
        items={[
          { label: "Model", value: MODEL_ID, mono: true },
          { label: "Pipeline", value: "4-agent sequential" },
          { label: "Agent 1", value: "Content extraction (multimodal)" },
          { label: "Agent 2", value: "Translation (JP → EN)" },
          { label: "Agent 3", value: "Analyzer (extract + score, 3x consensus)" },
          { label: "Agent 4", value: "External enrichment (web search)" },
          { label: "Scoring", value: "8 dimensions, weighted" },
          { label: "Concurrency", value: "3 parallel" },
        ]}
        badges={
          <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
        }
      />

      {/* Stats & Recent Runs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2.5">
              <Brain className="size-5 text-purple-700" />
            </div>
            <div>
              <CardTitle className="text-base">Processing Stats</CardTitle>
              <CardDescription>
                File processing overview and recent activity
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="size-3" />
                Total
              </div>
              <p className="mt-1 text-2xl font-semibold">{total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle className="size-3" />
                Completed
              </div>
              <p className="mt-1 text-2xl font-semibold text-green-700">{completed}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <XCircle className="size-3" />
                Failed
              </div>
              <p className="mt-1 text-2xl font-semibold text-red-600">{failed}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-blue-600">
                <Loader2 className="size-3" />
                In Progress
              </div>
              <p className="mt-1 text-2xl font-semibold text-blue-600">{processing + pending}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Star className="size-3" />
                Avg Score
              </div>
              <p className="mt-1 text-2xl font-semibold text-amber-600">
                {avgScore ? `${avgScore.toFixed(1)}/5` : "—"}
              </p>
            </div>
          </div>

          {recentFiles.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Recent Runs</h3>
              <div className="space-y-1.5">
                {recentFiles.map((file) => (
                  <div
                    key={file.fileId}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {file.status === "completed" ? (
                        <CheckCircle className="size-4 text-green-600 shrink-0" />
                      ) : file.status === "failed" ? (
                        <XCircle className="size-4 text-red-600 shrink-0" />
                      ) : file.status === "processing" ? (
                        <Loader2 className="size-4 text-blue-600 animate-spin shrink-0" />
                      ) : (
                        <Clock className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/${portcoSlug}/pipeline/${file.dealId}/overview`}
                          className="text-sm font-medium hover:underline truncate block"
                        >
                          {file.companyName}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate">
                          {file.fileName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {file.aiScore && (
                        <span className="flex items-center gap-0.5 text-xs font-medium">
                          <Star className="size-3 text-amber-500 fill-amber-500" />
                          {Number(file.aiScore).toFixed(1)}
                        </span>
                      )}
                      {file.processedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(file.processedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consistency Evals */}
      <EvalPanel
        portcoSlug={portcoSlug}
        processedFiles={processedFiles.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          dealId: f.dealId,
          companyName: f.companyName,
        }))}
        evalRuns={recentEvals.map((r) => ({
          id: r.id,
          fileName: r.fileName,
          iterations: r.iterations,
          status: r.status,
          overallScoreStdDev: r.overallScoreStdDev,
          flagAgreementRate: r.flagAgreementRate,
          nameConsistent: r.nameConsistent,
          scoreVariance: r.scoreVariance as Record<string, number> | null,
          promptVersionLabel: r.promptVersionLabel,
          modelId: r.modelId,
          createdAt: r.createdAt.toISOString(),
          completedAt: r.completedAt?.toISOString() ?? null,
        }))}
        isAdmin={isAdmin}
      />

      {/* System Prompts */}
      <PromptTabs
        portcoSlug={portcoSlug}
        tabs={[
          {
            id: "extraction",
            label: "Extraction",
            agentSlug: EXTRACTION_SLUG,
            currentTemplate: extractionData.currentTemplate,
            defaultTemplate: ANALYZER_EXTRACTION_TEMPLATE,
            renderedPrompt: extractionData.renderedPrompt,
            versions: extractionData.versionsForClient,
            description: "Extracts facts, numbers, and quotes from the PDF. No scoring or judgment.",
          },
          {
            id: "scoring",
            label: "Scoring",
            agentSlug: SCORING_SLUG,
            currentTemplate: scoringData.currentTemplate,
            defaultTemplate: ANALYZER_SCORING_TEMPLATE,
            renderedPrompt: scoringData.renderedPrompt,
            versions: scoringData.versionsForClient,
            description: "Scores dimensions and identifies red flags from the structured extraction.",
          },
        ]}
        legacyVersions={legacyData.versionsForClient.map((v) => ({
          id: v.id,
          version: v.version,
          changeNote: v.changeNote,
          createdAt: v.createdAt,
        }))}
        isAdmin={isAdmin}
      />
    </div>
  );
}
