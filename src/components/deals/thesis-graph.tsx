"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  Position,
  Handle,
  type NodeProps,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ThesisNode } from "./thesis-tree";

// ── Status colors ──

const STATUS_STYLES: Record<
  string,
  { border: string; bg: string; badgeClass: string; label: string }
> = {
  unknown: {
    border: "#d1d5db",
    bg: "#f9fafb",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    label: "Unknown",
  },
  partial: {
    border: "#fbbf24",
    bg: "#fffbeb",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    label: "Partial",
  },
  complete: {
    border: "#22c55e",
    bg: "#f0fdf4",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    label: "Complete",
  },
  risk: {
    border: "#ef4444",
    bg: "#fef2f2",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    label: "Risk",
  },
};

// ── Custom node component ──

type ThesisNodeData = {
  label: string;
  description: string | null;
  value: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  isLeaf: boolean;
};

function ThesisFlowNode({ data }: NodeProps<Node<ThesisNodeData>>) {
  const style = STATUS_STYLES[data.status] ?? STATUS_STYLES.unknown;
  const nodeStyle = useMemo(() => ({
    borderColor: style.border,
    borderLeftWidth: 3,
    backgroundColor: style.bg,
    maxWidth: 200,
    minWidth: 80,
    pointerEvents: "all" as const,
  }), [style.border, style.bg]);

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-border !w-1 !h-1 !min-w-0 !min-h-0 !border-0" />
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="rounded-md px-2.5 py-1.5 shadow-sm border cursor-default nopan nodrag"
              style={nodeStyle}
            >
              <p className="text-xs font-medium leading-tight">{data.label}</p>
              {data.value && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{data.value}</p>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs z-[100]">
            <p className="font-medium text-xs text-white">{data.label}</p>
            {data.description && <p className="text-xs text-gray-300 mt-0.5">{data.description}</p>}
            {data.value && <p className="text-xs text-white mt-1">{data.value}</p>}
            {data.notes && <p className="text-xs text-gray-400 mt-1 italic">{data.notes}</p>}
            <Badge className={`text-[10px] mt-1.5 ${style.badgeClass}`}>{style.label}</Badge>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Handle type="source" position={Position.Right} className="!bg-border !w-1 !h-1 !min-w-0 !min-h-0 !border-0" />
    </>
  );
}

const nodeTypes = { thesis: ThesisFlowNode };

// ── Tree layout algorithm ──

const NODE_WIDTH = 160;
const NODE_HEIGHT = 36;
const H_GAP = 120;
const V_GAP = 16;

interface LayoutResult {
  nodes: Node<ThesisNodeData>[];
  edges: Edge[];
  totalHeight: number;
}

/**
 * Lay out a tree left-to-right.
 * Returns the subtree height so the parent can center itself.
 */
function layoutTree(
  node: ThesisNode,
  x: number,
  y: number,
  nodes: Node<ThesisNodeData>[],
  edges: Edge[],
): number {
  const isLeaf = node.children.length === 0;

  if (isLeaf) {
    nodes.push({
      id: node.id,
      type: "thesis",
      position: { x, y },
      data: {
        label: node.label,
        description: node.description,
        value: node.value,
        notes: node.notes,
        status: node.status,
        source: node.source,
        isLeaf: true,
      },
    });
    return NODE_HEIGHT;
  }

  // Layout children first to determine total height
  const childX = x + NODE_WIDTH + H_GAP;
  let currentY = y;
  const childHeights: number[] = [];

  for (const child of node.children) {
    const childHeight = layoutTree(child, childX, currentY, nodes, edges);
    childHeights.push(childHeight);
    currentY += childHeight + V_GAP;
  }

  // Total height of all children including gaps
  const totalChildrenHeight = currentY - V_GAP - y;

  // Center the parent vertically relative to its children
  const parentY = y + totalChildrenHeight / 2 - NODE_HEIGHT / 2;

  nodes.push({
    id: node.id,
    type: "thesis",
    position: { x, y: parentY },
    data: {
      label: node.label,
      description: node.description,
      value: node.value,
      notes: node.notes,
      status: node.status,
      source: node.source,
      isLeaf: false,
    },
  });

  // Create edges from parent to children
  for (const child of node.children) {
    edges.push({
      id: `e-${node.id}-${child.id}`,
      source: node.id,
      target: child.id,
      type: "smoothstep",
      style: { stroke: "#d1d5db", strokeWidth: 1.5 },
    });
  }

  return Math.max(totalChildrenHeight, NODE_HEIGHT);
}

function buildLayout(roots: ThesisNode[]): LayoutResult {
  const nodes: Node<ThesisNodeData>[] = [];
  const edges: Edge[] = [];
  let currentY = 0;

  for (const root of roots) {
    const height = layoutTree(root, 0, currentY, nodes, edges);
    currentY += height + V_GAP * 2;
  }

  // Deduplicate edges
  const seen = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  return { nodes, edges: uniqueEdges, totalHeight: currentY };
}

// ── Flow wrapper with fit-view ──

function ThesisFlowInner({
  roots,
  downloadRef,
  companyName,
}: {
  roots: ThesisNode[];
  downloadRef: React.MutableRefObject<(() => Promise<void>) | null>;
  companyName: string;
}) {
  const { nodes, edges } = useMemo(() => buildLayout(roots), [roots]);

  const handleDownload = useCallback(async () => {
    const { toSvg } = await import("html-to-image");
    const headerHeight = 60;
    const padding = 20;

    const flowEl = document.querySelector<HTMLElement>(".react-flow__viewport");
    if (!flowEl) return;

    // Measure actual rendered bounds from all node DOM elements
    const nodeEls = flowEl.querySelectorAll<HTMLElement>(".react-flow__node");
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of nodeEls) {
      const transform = el.style.transform;
      const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
      if (!match) continue;
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      maxX = Math.max(maxX, x + el.offsetWidth);
      maxY = Math.max(maxY, y + el.offsetHeight);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
    }

    const contentWidth = (maxX - minX) + padding * 2;
    const contentHeight = (maxY - minY) + padding * 2;

    // Render at 1:1 scale, translating so bounds start at (padding, padding)
    const svgDataUrl = await toSvg(flowEl, {
      width: contentWidth,
      height: contentHeight,
      style: {
        width: `${contentWidth}px`,
        height: `${contentHeight}px`,
        transform: `translate(${-minX + padding}px, ${-minY + padding}px) scale(1)`,
      },
      backgroundColor: "#ffffff",
    });

    // Extract the inner SVG content and wrap with header
    const svgResponse = await fetch(svgDataUrl);
    const svgText = await svgResponse.text();

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    const originalSvg = svgDoc.documentElement;
    const innerContent = originalSvg.innerHTML;

    const timestamp = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const totalWidth = contentWidth;
    const totalHeight = contentHeight + headerHeight;

    const wrappedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" style="background: #ffffff;">
  <text x="20" y="28" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="bold" fill="#111827">DD Thesis — ${companyName}</text>
  <text x="20" y="48" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#6b7280">${timestamp}</text>
  <g transform="translate(0, ${headerHeight})">
    <svg width="${contentWidth}" height="${contentHeight}" xmlns="http://www.w3.org/2000/svg">${innerContent}</svg>
  </g>
</svg>`;

    const blob = new Blob([wrappedSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `thesis-${companyName.toLowerCase().replace(/\s+/g, "-")}-${dateStr}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [companyName]);

  downloadRef.current = handleDownload;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.05 }}
      minZoom={0.2}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      proOptions={{ hideAttribution: true }}
      className="!bg-transparent"
    />
  );
}

// ── Export ──

export function ThesisGraph({
  roots,
  downloadRef,
  companyName,
}: {
  roots: ThesisNode[];
  downloadRef: React.MutableRefObject<(() => Promise<void>) | null>;
  companyName: string;
}) {
  return (
    <div className="h-[calc(100vh-200px)] min-h-[400px] rounded-lg border bg-muted/20">
      <ReactFlowProvider>
        <ThesisFlowInner roots={roots} downloadRef={downloadRef} companyName={companyName} />
      </ReactFlowProvider>
    </div>
  );
}
