import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { files, fileExtractions, promptVersions } from "@/lib/db/schema";
import { eq, and, count, desc } from "drizzle-orm";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileOutput, FileText, CheckCircle } from "lucide-react";
import Link from "next/link";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AGENT_SLUG, CONTENT_EXTRACTION_TEMPLATE } from "@/lib/agents/content-extractor/prompt";
import { MODEL_ID } from "@/lib/agents/content-extractor";

export default async function ContentExtractorPage({
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

  const [totalFiles, v2Profiles, versions] = await Promise.all([
    db
      .select({ count: count(files.id) })
      .from(files)
      .where(and(eq(files.portcoId, portco.id), eq(files.processingStatus, "completed"))),

    db
      .select({ count: count(fileExtractions.id) })
      .from(fileExtractions)
      .innerJoin(files, eq(fileExtractions.fileId, files.id))
      .where(eq(files.portcoId, portco.id)),

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

  const total = Number(totalFiles[0]?.count ?? 0);
  const extracted = Number(v2Profiles[0]?.count ?? 0);

  const activeVersion = versions.find((v) => v.isActive);
  const currentTemplate = activeVersion?.template ?? CONTENT_EXTRACTION_TEMPLATE;

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
          <h1 className="text-2xl font-bold">Content Extractor</h1>
          <p className="text-sm text-muted-foreground">
            Extracts raw text content from PDF documents into structured markdown,
            preserving all text, tables, and formatting with page-level attribution
          </p>
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Configuration</CardTitle>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
              <Badge variant="outline" className="text-muted-foreground">Pipeline Agent</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model</span>
              <span className="font-mono">{MODEL_ID}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input</span>
              <span>Binary PDF (multimodal)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output</span>
              <span>Markdown per page + metadata</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Temperature</span>
              <span>0 (deterministic)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seed</span>
              <span>42</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Used in</span>
              <span>IM Processing Pipeline</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2.5">
              <FileOutput className="size-5 text-orange-700" />
            </div>
            <div>
              <CardTitle className="text-base">Extraction Stats</CardTitle>
              <CardDescription>
                PDF content extraction activity
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="size-3" />
                Total Files
              </div>
              <p className="mt-1 text-2xl font-semibold">{total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle className="size-3" />
                Extracted (v2)
              </div>
              <p className="mt-1 text-2xl font-semibold text-green-700">{extracted}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileOutput className="size-3" />
                Legacy (v1)
              </div>
              <p className="mt-1 text-2xl font-semibold text-muted-foreground">{total - extracted}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <PromptEditor
        portcoSlug={portcoSlug}
        agentSlug={AGENT_SLUG}
        currentTemplate={currentTemplate}
        defaultTemplate={CONTENT_EXTRACTION_TEMPLATE}
        renderedPrompt={currentTemplate}
        versions={versionsForClient}
        isAdmin={isOwnerOrAdmin}
        title="System Prompt"
        description="Controls how the agent transcribes PDF content into markdown. Changes affect all future extractions."
      />
    </div>
  );
}
