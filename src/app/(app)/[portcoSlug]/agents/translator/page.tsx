import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { files, fileExtractions } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages, CheckCircle, SkipForward } from "lucide-react";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AgentPageHeader } from "@/components/agents/agent-page-header";
import { AgentConfigCard } from "@/components/agents/agent-config-card";
import { getAgentPageAuth, getPromptVersionsForAgent } from "@/lib/agents/page-helpers";
import { AGENT_SLUG, TRANSLATION_TEMPLATE } from "@/lib/agents/translator/prompt";
import { MODEL_ID } from "@/lib/agents/translator";

export default async function TranslatorPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const { portco, isAnalyst, isAdmin } = await getAgentPageAuth(portcoSlug);
  if (!isAnalyst) notFound();

  const [v2Profiles, promptData] = await Promise.all([
    db
      .select({ count: count(fileExtractions.id) })
      .from(fileExtractions)
      .innerJoin(files, eq(fileExtractions.fileId, files.id))
      .where(eq(files.portcoId, portco.id)),

    getPromptVersionsForAgent(AGENT_SLUG, TRANSLATION_TEMPLATE),
  ]);

  const translated = Number(v2Profiles[0]?.count ?? 0);

  return (
    <div className="space-y-6">
      <AgentPageHeader
        portcoSlug={portcoSlug}
        title="Translator"
        description="Faithfully translates extracted document content to English, preserving all numbers, names, and formatting"
      />

      <AgentConfigCard
        items={[
          { label: "Model", value: MODEL_ID, mono: true },
          { label: "Input", value: "Extracted pages (text)" },
          { label: "Output", value: "Translated pages + original" },
          { label: "Temperature", value: "0 (deterministic)" },
          { label: "Batch Size", value: "15 pages" },
          { label: "Auto-skip", value: "English documents" },
          { label: "Used in", value: "IM Processing Pipeline" },
        ]}
      />

      {/* Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-100 p-2.5">
              <Languages className="size-5 text-cyan-700" />
            </div>
            <div>
              <CardTitle className="text-base">Translation Stats</CardTitle>
              <CardDescription>
                Document translation activity
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle className="size-3" />
                Documents Processed
              </div>
              <p className="mt-1 text-2xl font-semibold text-green-700">{translated}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <SkipForward className="size-3" />
                Auto-skip
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                English documents are passed through without translation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <PromptEditor
        portcoSlug={portcoSlug}
        agentSlug={AGENT_SLUG}
        currentTemplate={promptData.currentTemplate}
        defaultTemplate={TRANSLATION_TEMPLATE}
        renderedPrompt={promptData.renderedPrompt}
        versions={promptData.versionsForClient}
        isAdmin={isAdmin}
        title="System Prompt"
        description="Controls how the agent translates document content. Emphasizes faithfulness, number/name preservation, and M&A terminology."
      />
    </div>
  );
}
