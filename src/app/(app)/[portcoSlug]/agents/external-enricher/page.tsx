import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals, companyProfiles, promptVersions } from "@/lib/db/schema";
import { eq, and, count, desc, isNotNull } from "drizzle-orm";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, CheckCircle, Search } from "lucide-react";
import Link from "next/link";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AGENT_SLUG, EXTERNAL_ENRICHMENT_TEMPLATE } from "@/lib/agents/external-enricher/prompt";
import { MODEL_ID } from "@/lib/agents/external-enricher";

export default async function ExternalEnricherPage({
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

  const [enrichedProfiles, v2Profiles, versions] = await Promise.all([
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

  const enriched = Number(enrichedProfiles[0]?.count ?? 0);
  const v2Total = Number(v2Profiles[0]?.count ?? 0);

  const activeVersion = versions.find((v) => v.isActive);
  const currentTemplate = activeVersion?.template ?? EXTERNAL_ENRICHMENT_TEMPLATE;

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
          <h1 className="text-2xl font-bold">External Enricher</h1>
          <p className="text-sm text-muted-foreground">
            Searches the web for publicly available company information to complement
            IM analysis with market context, news, and risk indicators
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
              <span className="text-muted-foreground">Tools</span>
              <span>Google Search</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input</span>
              <span>Company name, industry, location</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output</span>
              <span>Company info, market context, risks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Steps</span>
              <span>5 search steps</span>
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
        currentTemplate={currentTemplate}
        defaultTemplate={EXTERNAL_ENRICHMENT_TEMPLATE}
        renderedPrompt={currentTemplate}
        versions={versionsForClient}
        isAdmin={isOwnerOrAdmin}
        title="System Prompt"
        description="Controls how the agent searches for and structures external company data. Affects search queries and result quality."
      />
    </div>
  );
}
