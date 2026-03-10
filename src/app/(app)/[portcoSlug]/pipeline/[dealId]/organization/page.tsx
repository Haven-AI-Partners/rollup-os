import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals, orgChartVersions, orgChartNodes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrgChart } from "@/components/deals/org-chart";
import { Users } from "lucide-react";

interface OrgNode {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  children: OrgNode[];
}

function buildTree(
  nodes: Array<{
    id: string;
    name: string;
    title: string | null;
    department: string | null;
    parentId: string | null;
    position: number;
  }>
): OrgNode[] {
  const nodeMap = new Map<string, OrgNode>();
  const roots: OrgNode[] = [];

  // Create all nodes
  for (const n of nodes) {
    nodeMap.set(n.id, {
      id: n.id,
      name: n.name,
      title: n.title,
      department: n.department,
      children: [],
    });
  }

  // Build parent-child relationships
  for (const n of nodes) {
    const node = nodeMap.get(n.id)!;
    if (n.parentId && nodeMap.has(n.parentId)) {
      nodeMap.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) notFound();

  // Get the active org chart version
  const [activeVersion] = await db
    .select()
    .from(orgChartVersions)
    .where(
      and(
        eq(orgChartVersions.dealId, dealId),
        eq(orgChartVersions.isActive, true),
      )
    )
    .orderBy(desc(orgChartVersions.version))
    .limit(1);

  // Get all versions for version selector
  const allVersions = await db
    .select({
      id: orgChartVersions.id,
      version: orgChartVersions.version,
      label: orgChartVersions.label,
      isActive: orgChartVersions.isActive,
      createdAt: orgChartVersions.createdAt,
    })
    .from(orgChartVersions)
    .where(eq(orgChartVersions.dealId, dealId))
    .orderBy(desc(orgChartVersions.version));

  // Get nodes for the active version
  const nodes = activeVersion
    ? await db
        .select({
          id: orgChartNodes.id,
          name: orgChartNodes.name,
          title: orgChartNodes.title,
          department: orgChartNodes.department,
          parentId: orgChartNodes.parentId,
          position: orgChartNodes.position,
        })
        .from(orgChartNodes)
        .where(eq(orgChartNodes.versionId, activeVersion.id))
        .orderBy(orgChartNodes.position)
    : [];

  const tree = buildTree(nodes);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-5" />
          <h2 className="text-lg font-semibold">Organization</h2>
          {nodes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {nodes.length} people
            </Badge>
          )}
        </div>
        {allVersions.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {activeVersion && (
              <Badge variant="outline" className="text-xs">
                {activeVersion.label ?? `v${activeVersion.version}`}
              </Badge>
            )}
            {allVersions.length > 1 && (
              <span>{allVersions.length} versions</span>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <OrgChart nodes={tree} />
        </CardContent>
      </Card>
    </div>
  );
}
