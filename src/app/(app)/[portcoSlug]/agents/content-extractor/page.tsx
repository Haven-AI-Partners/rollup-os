import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { files, fileExtractions } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileOutput, FileText, CheckCircle } from "lucide-react";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AgentPageHeader } from "@/components/agents/agent-page-header";
import { AgentConfigCard } from "@/components/agents/agent-config-card";
import { getAgentPageAuth, getPromptVersionsForAgent } from "@/lib/agents/page-helpers";
import { AGENT_SLUG, CONTENT_EXTRACTION_TEMPLATE } from "@/lib/agents/content-extractor/prompt";
import { MODEL_ID } from "@/lib/agents/content-extractor";

export default async function ContentExtractorPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const { portco, isAnalyst, isAdmin } = await getAgentPageAuth(portcoSlug);
  if (!isAnalyst) notFound();

  const [totalFiles, v2Profiles, promptData] = await Promise.all([
    db
      .select({ count: count(files.id) })
      .from(files)
      .where(and(eq(files.portcoId, portco.id), eq(files.processingStatus, "completed"))),

    db
      .select({ count: count(fileExtractions.id) })
      .from(fileExtractions)
      .innerJoin(files, eq(fileExtractions.fileId, files.id))
      .where(eq(files.portcoId, portco.id)),

    getPromptVersionsForAgent(AGENT_SLUG, CONTENT_EXTRACTION_TEMPLATE),
  ]);

  const total = Number(totalFiles[0]?.count ?? 0);
  const extracted = Number(v2Profiles[0]?.count ?? 0);

  return (
    <div className="space-y-6">
      <AgentPageHeader
        portcoSlug={portcoSlug}
        title="Content Extractor"
        description="Extracts raw text content from PDF documents into structured markdown, preserving all text, tables, and formatting with page-level attribution"
      />

      <AgentConfigCard
        items={[
          { label: "Model", value: MODEL_ID, mono: true },
          { label: "Input", value: "Binary PDF (multimodal)" },
          { label: "Output", value: "Markdown per page + metadata" },
          { label: "Temperature", value: "0 (deterministic)" },
          { label: "Seed", value: "42" },
          { label: "Used in", value: "IM Processing Pipeline" },
        ]}
      />

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
        currentTemplate={promptData.currentTemplate}
        defaultTemplate={CONTENT_EXTRACTION_TEMPLATE}
        renderedPrompt={promptData.renderedPrompt}
        versions={promptData.versionsForClient}
        isAdmin={isAdmin}
        title="System Prompt"
        description="Controls how the agent transcribes PDF content into markdown. Changes affect all future extractions."
      />
    </div>
  );
}
