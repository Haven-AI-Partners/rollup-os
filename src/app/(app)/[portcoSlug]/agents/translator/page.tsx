import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals, companyProfiles, promptVersions } from "@/lib/db/schema";
import { eq, and, count, desc, isNotNull } from "drizzle-orm";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Languages, CheckCircle, SkipForward } from "lucide-react";
import Link from "next/link";
import { PromptEditor } from "@/components/agents/prompt-editor";
import { AGENT_SLUG, TRANSLATION_TEMPLATE } from "@/lib/agents/translator/prompt";
import { MODEL_ID } from "@/lib/agents/translator";

export default async function TranslatorPage({
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

  const [v2Profiles, versions] = await Promise.all([
    db
      .select({ count: count(companyProfiles.id) })
      .from(companyProfiles)
      .innerJoin(deals, eq(companyProfiles.dealId, deals.id))
      .where(and(eq(deals.portcoId, portco.id), isNotNull(companyProfiles.rawContentExtraction))),

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

  const translated = Number(v2Profiles[0]?.count ?? 0);

  const activeVersion = versions.find((v) => v.isActive);
  const currentTemplate = activeVersion?.template ?? TRANSLATION_TEMPLATE;

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
          <h1 className="text-2xl font-bold">Translator</h1>
          <p className="text-sm text-muted-foreground">
            Faithfully translates extracted document content to English, preserving
            all numbers, names, and formatting
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
              <span>Extracted pages (text)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output</span>
              <span>Translated pages + original</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Temperature</span>
              <span>0 (deterministic)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Batch Size</span>
              <span>15 pages</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-skip</span>
              <span>English documents</span>
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
        currentTemplate={currentTemplate}
        defaultTemplate={TRANSLATION_TEMPLATE}
        renderedPrompt={currentTemplate}
        versions={versionsForClient}
        isAdmin={isOwnerOrAdmin}
        title="System Prompt"
        description="Controls how the agent translates document content. Emphasizes faithfulness, number/name preservation, and M&A terminology."
      />
    </div>
  );
}
