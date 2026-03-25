import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dealThesisNodes, deals, promptVersions } from "@/lib/db/schema";
import { eq, count, desc, sql } from "drizzle-orm";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  TreePine,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Circle,
} from "lucide-react";
import Link from "next/link";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AGENT_SLUG, DEFAULT_TEMPLATE, renderTemplate } from "@/lib/agents/thesis-generator/prompt";
import { MODEL_ID } from "@/lib/agents/thesis-generator";

export default async function ThesisGeneratorPage({
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

  // Load stats and prompt versions in parallel
  const [statusCounts, treeCounts, versions, recentDeals] = await Promise.all([
    // Count nodes by status across all deals
    db
      .select({
        status: dealThesisNodes.status,
        count: count(dealThesisNodes.id),
      })
      .from(dealThesisNodes)
      .where(eq(dealThesisNodes.portcoId, portco.id))
      .groupBy(dealThesisNodes.status),

    // Count deals with thesis trees
    db
      .select({
        count: sql<number>`count(distinct ${dealThesisNodes.dealId})`,
      })
      .from(dealThesisNodes)
      .where(eq(dealThesisNodes.portcoId, portco.id)),

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

    // Recent deals with thesis trees
    db
      .select({
        dealId: dealThesisNodes.dealId,
        companyName: deals.companyName,
        nodeCount: count(dealThesisNodes.id),
        completeCount: sql<number>`count(*) filter (where ${dealThesisNodes.status} = 'complete')`,
        riskCount: sql<number>`count(*) filter (where ${dealThesisNodes.status} = 'risk')`,
      })
      .from(dealThesisNodes)
      .innerJoin(deals, eq(dealThesisNodes.dealId, deals.id))
      .where(eq(dealThesisNodes.portcoId, portco.id))
      .groupBy(dealThesisNodes.dealId, deals.companyName)
      .orderBy(desc(sql`max(${dealThesisNodes.updatedAt})`))
      .limit(10),
  ]);

  const statusMap = new Map(statusCounts.map((s) => [s.status, Number(s.count)]));
  const totalNodes = [...statusMap.values()].reduce((a, b) => a + b, 0);
  const completeNodes = statusMap.get("complete") ?? 0;
  const partialNodes = statusMap.get("partial") ?? 0;
  const riskNodes = statusMap.get("risk") ?? 0;
  const unknownNodes = statusMap.get("unknown") ?? 0;
  const totalTrees = Number(treeCounts[0]?.count ?? 0);

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
          <h1 className="text-2xl font-bold">DD Thesis Generator</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered due diligence tree generation — maps all information needed to evaluate each deal
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
              <span className="text-muted-foreground">Model</span>
              <span className="font-mono">{MODEL_ID}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output</span>
              <span>Structured (generateObject)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base Template</span>
              <span>40 universal DD nodes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI Enhancement</span>
              <span>10-25 industry-specific nodes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pre-fill</span>
              <span>IM extraction data</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Node Statuses</span>
              <span>unknown, partial, complete, risk</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2.5">
              <TreePine className="size-5 text-emerald-700" />
            </div>
            <div>
              <CardTitle className="text-base">Thesis Stats</CardTitle>
              <CardDescription>
                DD thesis tree generation overview
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TreePine className="size-3" />
                Trees
              </div>
              <p className="mt-1 text-2xl font-semibold">{totalTrees}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Circle className="size-3" />
                Total Nodes
              </div>
              <p className="mt-1 text-2xl font-semibold">{totalNodes}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle className="size-3" />
                Complete
              </div>
              <p className="mt-1 text-2xl font-semibold text-green-700">{completeNodes}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Circle className="size-3" />
                Partial
              </div>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{partialNodes}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertTriangle className="size-3" />
                Risks
              </div>
              <p className="mt-1 text-2xl font-semibold text-red-600">{riskNodes}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HelpCircle className="size-3" />
                Unknown
              </div>
              <p className="mt-1 text-2xl font-semibold">{unknownNodes}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Deals with Trees */}
      {recentDeals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deals with Thesis Trees</CardTitle>
            <CardDescription>
              Recent deals that have DD thesis trees generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {recentDeals.map((deal) => {
                const leafTotal = Number(deal.nodeCount);
                const leafComplete = Number(deal.completeCount);
                const leafRisk = Number(deal.riskCount);
                const pct = leafTotal > 0 ? Math.round((leafComplete / leafTotal) * 100) : 0;
                return (
                  <Link
                    key={deal.dealId}
                    href={`/${portcoSlug}/pipeline/${deal.dealId}/thesis`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <TreePine className="size-4 text-emerald-600 shrink-0" />
                      <p className="text-sm font-medium truncate">{deal.companyName}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <span className="text-xs text-muted-foreground">
                        {leafTotal} nodes
                      </span>
                      <span className="text-xs text-green-700">
                        {pct}% complete
                      </span>
                      {leafRisk > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-red-600">
                          <AlertTriangle className="size-3" />
                          {leafRisk}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8">
            <TreePine className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No thesis trees generated yet. Open a deal and click &quot;Generate Thesis Tree&quot; on the Thesis tab.
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
        isAdmin={isOwnerOrAdmin}
        title="System Prompt"
        description="Instructions for generating industry-specific thesis nodes. Use {{COMPANY_NAME}}, {{INDUSTRY}}, {{BUSINESS_MODEL}}, {{MARKET_POSITION}}, {{STRENGTHS}}, {{KEY_RISKS}}, {{INVESTMENT_THESIS}}, {{TEMPLATE_NODES}}, {{RAW_OBSERVATIONS}} as placeholders."
      />
    </div>
  );
}
