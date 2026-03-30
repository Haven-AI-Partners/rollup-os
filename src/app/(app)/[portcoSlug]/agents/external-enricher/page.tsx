import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals, companyProfiles } from "@/lib/db/schema";
import { eq, and, count, isNotNull } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, CheckCircle, Search } from "lucide-react";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AgentPageHeader } from "@/components/agents/agent-page-header";
import { AgentConfigCard } from "@/components/agents/agent-config-card";
import { getAgentPageAuth, getPromptVersionsForAgent } from "@/lib/agents/page-helpers";
import { AGENT_SLUG, EXTERNAL_ENRICHMENT_TEMPLATE } from "@/lib/agents/external-enricher/prompt";
import { MODEL_ID } from "@/lib/agents/external-enricher";

export default async function ExternalEnricherPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const { portco, isAnalyst, isAdmin } = await getAgentPageAuth(portcoSlug);
  if (!isAnalyst) notFound();

  const [enrichedProfiles, v2Profiles, promptData] = await Promise.all([
    db
      .select({ count: count(companyProfiles.id) })
      .from(companyProfiles)
      .innerJoin(deals, eq(companyProfiles.dealId, deals.id))
      .where(and(eq(deals.portcoId, portco.id), isNotNull(companyProfiles.externalEnrichment))),

    db
      .select({ count: count(companyProfiles.id) })
      .from(companyProfiles)
      .innerJoin(deals, eq(companyProfiles.dealId, deals.id))
      .where(and(eq(deals.portcoId, portco.id), eq(companyProfiles.pipelineVersion, "v2"))),

    getPromptVersionsForAgent(AGENT_SLUG, EXTERNAL_ENRICHMENT_TEMPLATE),
  ]);

  const enriched = Number(enrichedProfiles[0]?.count ?? 0);
  const v2Total = Number(v2Profiles[0]?.count ?? 0);

  return (
    <div className="space-y-6">
      <AgentPageHeader
        portcoSlug={portcoSlug}
        title="External Enricher"
        description="Searches the web for publicly available company information to complement IM analysis with market context, news, and risk indicators"
      />

      <AgentConfigCard
        items={[
          { label: "Model", value: MODEL_ID, mono: true },
          { label: "Tools", value: "Google Search" },
          { label: "Input", value: "Company name, industry, location" },
          { label: "Output", value: "Company info, market context, risks" },
          { label: "Max Steps", value: "5 search steps" },
          { label: "Used in", value: "IM Processing Pipeline" },
        ]}
      />

      {/* Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <Globe className="size-5 text-amber-700" />
            </div>
            <div>
              <CardTitle className="text-base">Enrichment Stats</CardTitle>
              <CardDescription>
                External data enrichment activity
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle className="size-3" />
                Companies Enriched
              </div>
              <p className="mt-1 text-2xl font-semibold text-green-700">{enriched}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Search className="size-3" />
                Pipeline v2 Total
              </div>
              <p className="mt-1 text-2xl font-semibold">{v2Total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Globe className="size-3" />
                Coverage
              </div>
              <p className="mt-1 text-2xl font-semibold text-amber-600">
                {v2Total > 0 ? `${Math.round((enriched / v2Total) * 100)}%` : "—"}
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
        defaultTemplate={EXTERNAL_ENRICHMENT_TEMPLATE}
        renderedPrompt={promptData.renderedPrompt}
        versions={promptData.versionsForClient}
        isAdmin={isAdmin}
        title="System Prompt"
        description="Controls how the agent searches for and structures external company data. Affects search queries and result quality."
      />
    </div>
  );
}
