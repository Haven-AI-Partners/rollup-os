import { notFound } from "next/navigation";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
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
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatDateShort } from "@/lib/format";
import { EvalPanel } from "@/components/agents/eval-panel";
import { PromptTabs } from "@/components/agents/prompt-tabs";
import {
  EXTRACTION_TEMPLATE,
  SCORING_TEMPLATE,
  renderTemplate,
  EXTRACTION_SLUG,
  SCORING_SLUG,
} from "@/lib/agents/im-processor/prompt";
import {
  getAgentStats,
  getRecentProcessedFiles,
  getProcessedFilesForEval,
  getRecentEvalRuns,
  getAllPromptVersions,
} from "@/lib/actions/agents";

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

  const [stats, recentFiles, processedFiles, recentEvals, promptData] = await Promise.all([
    getAgentStats(portco.id),
    getRecentProcessedFiles(portco.id),
    getProcessedFilesForEval(portco.id),
    getRecentEvalRuns(),
    getAllPromptVersions(),
  ]);

  const { extractionVersions, scoringVersions, legacyVersions } = promptData;

  // Determine which templates are active
  const activeExtraction = extractionVersions.find((v) => v.isActive);
  const currentExtractionTemplate = activeExtraction?.template ?? EXTRACTION_TEMPLATE;
  const renderedExtractionPrompt = renderTemplate(currentExtractionTemplate);

  const activeScoring = scoringVersions.find((v) => v.isActive);
  const currentScoringTemplate = activeScoring?.template ?? SCORING_TEMPLATE;
  const renderedScoringPrompt = renderTemplate(currentScoringTemplate);

  // Serialize versions for client components
  const serializeVersions = (versions: typeof extractionVersions) =>
    versions.map((v) => ({
      id: v.id,
      version: v.version,
      template: v.template,
      isActive: v.isActive,
      changeNote: v.changeNote,
      createdAt: v.createdAt.toISOString(),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agents</h1>
        <p className="text-sm text-muted-foreground">
          AI agents that automate deal sourcing and evaluation
        </p>
      </div>

      {/* IM Processor Agent */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2.5">
                <Brain className="size-5 text-purple-700" />
              </div>
              <div>
                <CardTitle className="text-base">IM Processor</CardTitle>
                <CardDescription>
                  Analyzes Information Memorandum PDFs with AI to extract company
                  profiles, score deals across 8 dimensions, and flag risks
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800 border-green-200">
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="size-3" />
                Total
              </div>
              <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle className="size-3" />
                Completed
              </div>
              <p className="mt-1 text-2xl font-semibold text-green-700">{stats.completed}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <XCircle className="size-3" />
                Failed
              </div>
              <p className="mt-1 text-2xl font-semibold text-red-600">{stats.failed}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-blue-600">
                <Loader2 className="size-3" />
                In Progress
              </div>
              <p className="mt-1 text-2xl font-semibold text-blue-600">{stats.inProgress}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Star className="size-3" />
                Avg Score
              </div>
              <p className="mt-1 text-2xl font-semibold text-amber-600">
                {stats.avgScore ? `${stats.avgScore.toFixed(1)}/5` : "—"}
              </p>
            </div>
          </div>

          {/* Recent activity (last 3) */}
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
                          {formatDateShort(file.processedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Config details */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h3 className="text-sm font-medium mb-2">Configuration</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-mono">{MODEL_ID}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pipeline</span>
                <span>Two-pass (extract + score)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pass 1</span>
                <span>PDF extraction (multimodal)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pass 2</span>
                <span>Scoring + flags (3x consensus)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scoring</span>
                <span>8 dimensions, weighted</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Concurrency</span>
                <span>3 parallel</span>
              </div>
            </div>
          </div>
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

      {/* System Prompts — tabbed */}
      <PromptTabs
        portcoSlug={portcoSlug}
        tabs={[
          {
            id: "extraction",
            label: "Extraction",
            agentSlug: EXTRACTION_SLUG,
            currentTemplate: currentExtractionTemplate,
            defaultTemplate: EXTRACTION_TEMPLATE,
            renderedPrompt: renderedExtractionPrompt,
            versions: serializeVersions(extractionVersions),
            description: "Extracts facts, numbers, and quotes from the PDF. No scoring or judgment.",
          },
          {
            id: "scoring",
            label: "Scoring",
            agentSlug: SCORING_SLUG,
            currentTemplate: currentScoringTemplate,
            defaultTemplate: SCORING_TEMPLATE,
            renderedPrompt: renderedScoringPrompt,
            versions: serializeVersions(scoringVersions),
            description: "Scores dimensions and identifies red flags from the structured extraction.",
          },
        ]}
        legacyVersions={legacyVersions.map((v) => ({
          id: v.id,
          version: v.version,
          changeNote: v.changeNote,
          createdAt: v.createdAt.toISOString(),
        }))}
        isAdmin={isAdmin}
      />

      {/* Placeholder for future agents */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-8">
          <AlertTriangle className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            More agents coming soon — Deal Sourcing, Broker Engagement
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
