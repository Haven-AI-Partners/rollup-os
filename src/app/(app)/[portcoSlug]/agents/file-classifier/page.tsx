import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { files, deals, promptVersions } from "@/lib/db/schema";
import { eq, and, count, desc, avg, isNotNull, sql } from "drizzle-orm";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FolderSearch,
  FileText,
  Target,
  CheckCircle,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AGENT_SLUG, DEFAULT_TEMPLATE, renderTemplate } from "@/lib/agents/file-classifier/prompt";
import { MODEL_ID, RULE_CONFIDENCE_THRESHOLD } from "@/lib/agents/file-classifier/constants";
import { FILE_TYPE_LABELS } from "@/lib/constants";

export default async function FileClassifierPage({
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

  const [typeCounts, confidenceStats, totalClassified, versions, recentFiles] =
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

      // Prompt versions
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

  // Prompt versioning
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${portcoSlug}/agents`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">File Classifier</h1>
          <p className="text-sm text-muted-foreground">
            Classifies GDrive files by type using metadata signals to route
            documents through the pipeline
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
              <span className="text-muted-foreground">Approach</span>
              <span>Hybrid (rules + LLM vision)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vision Model</span>
              <span className="font-mono">{MODEL_ID}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tier 1 (Rules)</span>
              <span>Keyword matching on metadata</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tier 2 (Vision)</span>
              <span>PDF page images + metadata</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Escalation Threshold</span>
              <span>{(RULE_CONFIDENCE_THRESHOLD * 100).toFixed(0)}% confidence</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">File Types</span>
              <span>15 categories</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Languages</span>
              <span>English + Japanese</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
        currentTemplate={currentTemplate}
        defaultTemplate={DEFAULT_TEMPLATE}
        renderedPrompt={renderedPrompt}
        versions={versionsForClient}
        isAdmin={isAdmin}
        title="System Prompt"
        description="Instructions for classifying files by type. Use {{FILE_TYPES}} as a placeholder for the file type definitions list."
      />
    </div>
  );
}
