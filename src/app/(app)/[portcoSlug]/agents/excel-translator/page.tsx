import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, CheckCircle, Clock } from "lucide-react";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AgentPageHeader } from "@/components/agents/agent-page-header";
import { AgentConfigCard } from "@/components/agents/agent-config-card";
import { getAgentPageAuth, getPromptVersionsForAgent } from "@/lib/agents/page-helpers";
import { AGENT_SLUG, TRANSLATION_TEMPLATE } from "@/lib/agents/excel-translator/prompt";
import { MODEL_ID } from "@/lib/agents/excel-translator";

export default async function ExcelTranslatorPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const { portco, isAnalyst, isAdmin } = await getAgentPageAuth(portcoSlug);
  if (!isAnalyst) notFound();

  const [completedFiles, pendingFiles, promptData] = await Promise.all([
    db
      .select({ count: count(files.id) })
      .from(files)
      .where(
        and(
          eq(files.portcoId, portco.id),
          eq(files.fileType, "excel_data"),
          eq(files.processingStatus, "completed"),
        ),
      ),

    db
      .select({ count: count(files.id) })
      .from(files)
      .where(
        and(
          eq(files.portcoId, portco.id),
          eq(files.fileType, "excel_data"),
          eq(files.processingStatus, "pending"),
        ),
      ),

    getPromptVersionsForAgent(AGENT_SLUG, TRANSLATION_TEMPLATE),
  ]);

  const translated = Number(completedFiles[0]?.count ?? 0);
  const pending = Number(pendingFiles[0]?.count ?? 0);

  return (
    <div className="space-y-6">
      <AgentPageHeader
        portcoSlug={portcoSlug}
        title="Excel Translator"
        description="Translates Japanese Excel spreadsheets to English in-place, preserving formatting, formulas, and structure"
      />

      <AgentConfigCard
        items={[
          { label: "Model", value: MODEL_ID, mono: true },
          { label: "Input", value: "Excel (.xlsx) from GDrive" },
          { label: "Output", value: "Translated .xlsx in Supabase Storage" },
          { label: "Temperature", value: "0 (deterministic)" },
          { label: "Batch Size", value: "~4000 chars per LLM call" },
          { label: "Preserves", value: "Formulas, formatting, merged cells" },
          { label: "Auto-skip", value: "Non-CJK cells, numbers, dates" },
        ]}
      />

      {/* Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-teal-100 p-2.5">
              <FileSpreadsheet className="size-5 text-teal-700" />
            </div>
            <div>
              <CardTitle className="text-base">Translation Stats</CardTitle>
              <CardDescription>
                Excel file translation activity
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle className="size-3" />
                Files Translated
              </div>
              <p className="mt-1 text-2xl font-semibold text-green-700">{translated}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3" />
                Pending
              </div>
              <p className="mt-1 text-2xl font-semibold">{pending}</p>
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
        description="Controls how the agent translates Excel cell values. Emphasizes faithfulness, number/name preservation, and concise translations for headers."
      />
    </div>
  );
}
