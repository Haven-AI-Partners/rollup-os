import { db } from "@/lib/db";
import { files, deals } from "@/lib/db/schema";
import { eq, and, count, avg, isNotNull, sql, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderSearch,
  FileText,
  Target,
  CheckCircle,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AgentPageHeader } from "@/components/agents/agent-page-header";
import { AgentConfigCard } from "@/components/agents/agent-config-card";
import { getAgentPageAuth, getPromptVersionsForAgent } from "@/lib/agents/page-helpers";
import { AGENT_SLUG, DEFAULT_TEMPLATE, renderTemplate } from "@/lib/agents/file-classifier/prompt";
import { MODEL_ID, RULE_CONFIDENCE_THRESHOLD } from "@/lib/agents/file-classifier/constants";
import { FILE_TYPE_LABELS } from "@/lib/constants";

export default async function FileClassifierPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const { portco, isAdmin } = await getAgentPageAuth(portcoSlug);

  const [typeCounts, confidenceStats, totalClassified, promptData, recentFiles] =
    await Promise.all([
      // Count files and avg confidence by type (auto-classified only)
      db
        .select({
          fileType: files.fileType,
          count: count(files.id),
          avgConfidence: avg(
            sql<number>`cast(${files.classificationConfidence} as numeric)`,
          ),
        })
        .from(files)
        .where(
          and(eq(files.portcoId, portco.id), eq(files.classifiedBy, "auto")),
        )
        .groupBy(files.fileType),

      // Average confidence
      db
        .select({
          avg: avg(
            sql<number>`cast(${files.classificationConfidence} as numeric)`,
          ),
        })
        .from(files)
        .where(
          and(
            eq(files.portcoId, portco.id),
            eq(files.classifiedBy, "auto"),
            isNotNull(files.classificationConfidence),
          ),
        ),

      // Total files with any type
      db
        .select({ count: count(files.id) })
        .from(files)
        .where(
          and(eq(files.portcoId, portco.id), isNotNull(files.fileType)),
        ),

      getPromptVersionsForAgent(AGENT_SLUG, DEFAULT_TEMPLATE, renderTemplate),

      // Recent auto-classified files
      db
        .select({
          id: files.id,
          fileName: files.fileName,
          fileType: files.fileType,
          classificationConfidence: files.classificationConfidence,
          classificationTier: files.classificationTier,
          suggestedCompanyName: files.suggestedCompanyName,
          gdriveParentPath: files.gdriveParentPath,
          dealId: files.dealId,
          companyName: deals.companyName,
          createdAt: files.createdAt,
        })
        .from(files)
        .leftJoin(deals, eq(files.dealId, deals.id))
        .where(
          and(eq(files.portcoId, portco.id), eq(files.classifiedBy, "auto")),
        )
        .orderBy(desc(files.createdAt))
        .limit(10),
    ]);

  const autoClassified = typeCounts.reduce(
    (sum, t) => sum + Number(t.count),
    0,
  );
  const total = Number(totalClassified[0]?.count ?? 0);
  const avgConfidence = confidenceStats[0]?.avg
    ? Number(confidenceStats[0].avg)
    : null;

  // Count files by classification tier from recent files
  const rulesCount = recentFiles.filter((f) => f.classificationTier === "rules").length;
  const visionCount = recentFiles.filter((f) => f.classificationTier === "vision").length;

  // Sort type counts descending
  const sortedTypes = typeCounts
    .map((t) => ({
      fileType: t.fileType,
      count: Number(t.count),
      avgConfidence: t.avgConfidence ? Number(t.avgConfidence) : null,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <AgentPageHeader
        portcoSlug={portcoSlug}
        title="File Classifier"
        description="Classifies GDrive files by type using metadata signals to route documents through the pipeline"
      />

      <AgentConfigCard
        items={[
          { label: "Approach", value: "Hybrid (rules + LLM vision)" },
          { label: "Vision Model", value: MODEL_ID, mono: true },
          { label: "Tier 1 (Rules)", value: "Keyword matching on metadata" },
          { label: "Tier 2 (Vision)", value: "PDF page images + metadata" },
          { label: "Escalation Threshold", value: `${(RULE_CONFIDENCE_THRESHOLD * 100).toFixed(0)}% confidence` },
          { label: "File Types", value: "15 categories" },
          { label: "Languages", value: "English + Japanese" },
        ]}
        badges={
          <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
        }
      />

      {/* Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2.5">
              <FolderSearch className="size-5 text-orange-700" />
            </div>
            <div>
              <CardTitle className="text-base">Classification Stats</CardTitle>
              <CardDescription>
                File classification overview and type distribution
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="size-3" />
                Total Classified
              </div>
              <p className="mt-1 text-2xl font-semibold">{total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-orange-700">
                <CheckCircle className="size-3" />
                Auto-Classified
              </div>
              <p className="mt-1 text-2xl font-semibold text-orange-700">
                {autoClassified}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-blue-600">
                <Tag className="size-3" />
                File Types Seen
              </div>
              <p className="mt-1 text-2xl font-semibold text-blue-600">
                {sortedTypes.length}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Target className="size-3" />
                Avg Confidence
              </div>
              <p className="mt-1 text-2xl font-semibold text-amber-600">
                {avgConfidence ? `${(avgConfidence * 100).toFixed(0)}%` : "—"}
              </p>
            </div>
          </div>

          {/* Type distribution */}
          {sortedTypes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">
                Type Distribution
              </h3>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {sortedTypes.map((t) => (
                  <div
                    key={t.fileType}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-xs font-medium">
                      {FILE_TYPE_LABELS[t.fileType ?? ""] ?? t.fileType}
                    </span>
                    <div className="flex items-center gap-2">
                      {t.avgConfidence !== null && (
                        <span className="text-[10px] text-muted-foreground">
                          {(t.avgConfidence * 100).toFixed(0)}%
                        </span>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {t.count}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Classifications */}
      {recentFiles.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Classifications</CardTitle>
            <CardDescription>
              Latest files classified — {rulesCount} by rules, {visionCount} by vision
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {recentFiles.map((file) => {
                const confidence = file.classificationConfidence
                  ? Number(file.classificationConfidence)
                  : null;
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FolderSearch className="size-4 text-orange-600 shrink-0" />
                      <div className="min-w-0">
                        {file.dealId ? (
                          <Link
                            href={`/${portcoSlug}/pipeline/${file.dealId}/files`}
                            className="text-sm font-medium hover:underline truncate block"
                          >
                            {file.fileName}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium truncate">
                            {file.fileName}
                          </p>
                        )}
                        {file.gdriveParentPath && (
                          <p className="text-xs text-muted-foreground truncate">
                            {file.gdriveParentPath}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {file.classificationTier && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${file.classificationTier === "rules" ? "border-green-300 text-green-700" : "border-purple-300 text-purple-700"}`}
                        >
                          {file.classificationTier}
                        </Badge>
                      )}
                      {file.fileType && (
                        <Badge variant="secondary" className="text-[10px]">
                          {FILE_TYPE_LABELS[file.fileType] ?? file.fileType}
                        </Badge>
                      )}
                      {confidence !== null && (
                        <span className="text-xs text-muted-foreground">
                          {(confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8">
            <FolderSearch className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No files classified yet. Connect a GDrive folder and run a scan to
              start classifying files.
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
        description="Instructions for classifying files by type. Use {{FILE_TYPES}} as a placeholder for the file type definitions list."
      />
    </div>
  );
}
