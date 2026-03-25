import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dealThesisNodes, companyProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { TreePine } from "lucide-react";
import { getDeal } from "@/lib/db/cached-queries";
import { ThesisTree, type ThesisNode } from "@/components/deals/thesis-tree";
import { GenerateThesisButton } from "@/components/deals/generate-thesis-button";

function buildTree(
  nodes: Array<{
    id: string;
    parentId: string | null;
    label: string;
    description: string | null;
    status: string;
    value: string | null;
    source: string | null;
    sourceDetail: string | null;
    notes: string | null;
    templateNodeId: string | null;
    sortOrder: number;
  }>,
): { roots: ThesisNode[]; leafCount: Record<string, number> } {
  const nodeMap = new Map<string, ThesisNode>();
  const leafCount = { unknown: 0, partial: 0, complete: 0, risk: 0 };

  // Create all nodes
  for (const n of nodes) {
    nodeMap.set(n.id, {
      id: n.id,
      label: n.label,
      description: n.description,
      status: n.status as ThesisNode["status"],
      value: n.value,
      source: n.source,
      sourceDetail: n.sourceDetail,
      notes: n.notes,
      templateNodeId: n.templateNodeId,
      children: [],
    });
  }

  // Build relationships
  const roots: ThesisNode[] = [];
  for (const n of nodes) {
    const node = nodeMap.get(n.id)!;
    if (n.parentId && nodeMap.has(n.parentId)) {
      nodeMap.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by sortOrder
  for (const n of nodes) {
    const node = nodeMap.get(n.id)!;
    node.children.sort((a, b) => {
      const aSort = nodes.find((x) => x.id === a.id)?.sortOrder ?? 0;
      const bSort = nodes.find((x) => x.id === b.id)?.sortOrder ?? 0;
      return aSort - bSort;
    });
  }

  // Count leaf nodes by status
  for (const n of nodes) {
    const node = nodeMap.get(n.id)!;
    if (node.children.length === 0) {
      const status = n.status as keyof typeof leafCount;
      if (status in leafCount) leafCount[status]++;
    }
  }

  return { roots, leafCount };
}

export default async function ThesisPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const deal = await getDeal(dealId);
  if (!deal) notFound();

  const [nodes, profile] = await Promise.all([
    db
      .select({
        id: dealThesisNodes.id,
        parentId: dealThesisNodes.parentId,
        label: dealThesisNodes.label,
        description: dealThesisNodes.description,
        status: dealThesisNodes.status,
        value: dealThesisNodes.value,
        source: dealThesisNodes.source,
        sourceDetail: dealThesisNodes.sourceDetail,
        notes: dealThesisNodes.notes,
        templateNodeId: dealThesisNodes.templateNodeId,
        sortOrder: dealThesisNodes.sortOrder,
      })
      .from(dealThesisNodes)
      .where(eq(dealThesisNodes.dealId, dealId)),
    db
      .select({ id: companyProfiles.id })
      .from(companyProfiles)
      .where(eq(companyProfiles.dealId, dealId))
      .limit(1),
  ]);

  if (nodes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TreePine className="size-5" />
          <h2 className="text-lg font-semibold">DD Thesis</h2>
        </div>
        <GenerateThesisButton
          dealId={dealId}
          portcoId={deal.portcoId}
          portcoSlug={portcoSlug}
          hasProfile={profile.length > 0}
        />
      </div>
    );
  }

  const { roots, leafCount } = buildTree(nodes);
  const stats = {
    unknown: leafCount.unknown,
    partial: leafCount.partial,
    complete: leafCount.complete,
    risk: leafCount.risk,
    total: leafCount.unknown + leafCount.partial + leafCount.complete + leafCount.risk,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TreePine className="size-5" />
        <h2 className="text-lg font-semibold">DD Thesis</h2>
        <Badge variant="secondary" className="text-xs">
          {nodes.length} nodes
        </Badge>
      </div>

      <ThesisTree
        roots={roots}
        portcoSlug={portcoSlug}
        dealId={dealId}
        companyName={deal.companyName}
        stats={stats}
      />
    </div>
  );
}
