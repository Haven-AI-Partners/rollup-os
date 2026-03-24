"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  ChevronDown,
  Circle,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  X,
  Save,
  List,
  GitBranchPlus,
  Download,
} from "lucide-react";
import { updateThesisNode } from "@/lib/actions/thesis";

export interface ThesisNode {
  id: string;
  label: string;
  description: string | null;
  status: "unknown" | "partial" | "complete" | "risk";
  value: string | null;
  source: string | null;
  sourceDetail: string | null;
  notes: string | null;
  templateNodeId: string | null;
  children: ThesisNode[];
}

interface ThesisTreeProps {
  roots: ThesisNode[];
  portcoSlug: string;
  dealId: string;
  companyName: string;
  stats: { unknown: number; partial: number; complete: number; risk: number; total: number };
}

const STATUS_CONFIG = {
  unknown: {
    color: "border-muted-foreground/20 bg-muted/30",
    icon: HelpCircle,
    iconColor: "text-muted-foreground/40",
    label: "Unknown",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
  },
  partial: {
    color: "border-amber-300 bg-amber-50",
    icon: Circle,
    iconColor: "text-amber-500",
    label: "Partial",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  complete: {
    color: "border-green-300 bg-green-50",
    icon: CheckCircle,
    iconColor: "text-green-600",
    label: "Complete",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
  },
  risk: {
    color: "border-red-300 bg-red-50",
    icon: AlertTriangle,
    iconColor: "text-red-600",
    label: "Risk",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
  },
} as const;

// ── Helpers ──

function countLeafStatuses(node: ThesisNode): Record<string, number> {
  const counts: Record<string, number> = { complete: 0, partial: 0, unknown: 0, risk: 0 };
  if (node.children.length === 0) {
    counts[node.status]++;
    return counts;
  }
  for (const child of node.children) {
    const childCounts = countLeafStatuses(child);
    for (const [k, v] of Object.entries(childCounts)) {
      counts[k] = (counts[k] ?? 0) + v;
    }
  }
  return counts;
}

// ── List View ──

function ThesisNodeRow({
  node,
  depth,
  portcoSlug,
  dealId,
}: {
  node: ThesisNode;
  depth: number;
  portcoSlug: string;
  dealId: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    status: node.status,
    value: node.value ?? "",
    notes: node.notes ?? "",
  });

  const config = STATUS_CONFIG[node.status];
  const StatusIcon = config.icon;
  const hasChildren = node.children.length > 0;
  const isLeaf = !hasChildren;

  async function handleSave() {
    setSaving(true);
    try {
      await updateThesisNode(node.id, portcoSlug, dealId, {
        status: editData.status,
        value: editData.value.trim() || null,
        notes: editData.notes.trim() || null,
        source: "manual",
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div
        className={`group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50 cursor-pointer ${editing ? "bg-muted/30" : ""}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          else setEditing(!editing);
        }}
      >
        <span className="shrink-0 mt-0.5 p-0.5">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )
          ) : (
            <span className="size-4 inline-block" />
          )}
        </span>

        <StatusIcon className={`size-4 shrink-0 mt-0.5 ${config.iconColor}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-left">
              {node.label}
            </span>
            {node.source && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {node.source === "im_extracted" ? "IM" : node.source === "agent_generated" ? "AI" : node.source}
              </Badge>
            )}
          </div>
          {node.value && !editing && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{node.value}</p>
          )}
          {node.description && !node.value && !editing && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">{node.description}</p>
          )}
        </div>

        {isLeaf && !editing && (
          <Badge className={`text-[10px] shrink-0 ${config.badgeClass}`}>
            {config.label}
          </Badge>
        )}
        {hasChildren && (() => {
          const counts = countLeafStatuses(node);
          const total = counts.complete + counts.partial + counts.unknown + counts.risk;
          return (
            <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground">
              {counts.complete > 0 && (
                <span className="flex items-center gap-0.5 text-green-600">
                  <CheckCircle className="size-2.5" />
                  {counts.complete}
                </span>
              )}
              {counts.partial > 0 && (
                <span className="flex items-center gap-0.5 text-amber-500">
                  <Circle className="size-2.5" />
                  {counts.partial}
                </span>
              )}
              {counts.risk > 0 && (
                <span className="flex items-center gap-0.5 text-red-600">
                  <AlertTriangle className="size-2.5" />
                  {counts.risk}
                </span>
              )}
              {counts.unknown > 0 && (
                <span className="flex items-center gap-0.5">
                  <HelpCircle className="size-2.5" />
                  {counts.unknown}
                </span>
              )}
              <span className="text-muted-foreground/50">/{total}</span>
            </div>
          );
        })()}
      </div>

      {editing && (
        <div
          className="rounded-md border bg-background p-3 mb-1 space-y-3"
          style={{ marginLeft: `${depth * 20 + 36}px`, marginRight: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-14 shrink-0">Status</label>
            <Select
              value={editData.status}
              onValueChange={(v) => setEditData((d) => ({ ...d, status: v as typeof d.status }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start gap-2">
            <label className="text-xs text-muted-foreground w-14 shrink-0 mt-2">Value</label>
            <Input
              value={editData.value}
              onChange={(e) => setEditData((d) => ({ ...d, value: e.target.value }))}
              placeholder="Data point or finding..."
              className="h-8 text-xs"
            />
          </div>
          <div className="flex items-start gap-2">
            <label className="text-xs text-muted-foreground w-14 shrink-0 mt-2">Notes</label>
            <Textarea
              value={editData.notes}
              onChange={(e) => setEditData((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Additional notes..."
              className="text-xs resize-none"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-7 text-xs">
              <X className="size-3 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs">
              <Save className="size-3 mr-1" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {expanded &&
        node.children.map((child) => (
          <ThesisNodeRow key={child.id} node={child} depth={depth + 1} portcoSlug={portcoSlug} dealId={dealId} />
        ))}
    </div>
  );
}

// ── Graph View (lazy-loaded) ──

const ThesisGraph = dynamic(
  () => import("./thesis-graph").then((m) => ({ default: m.ThesisGraph })),
  { ssr: false, loading: () => <div className="h-[600px] rounded-lg border bg-muted/20 animate-pulse" /> },
);

// ── Main Component ──

export function ThesisTree({ roots, portcoSlug, dealId, companyName, stats }: ThesisTreeProps) {
  const [view, setView] = useState<"list" | "graph">("graph");
  const [downloading, setDownloading] = useState(false);
  const downloadRef = useRef<(() => Promise<void>) | null>(null);
  const completionPct = stats.total > 0 ? Math.round(((stats.complete + stats.partial) / stats.total) * 100) : 0;

  async function handleDownload() {
    if (!downloadRef.current) return;
    setDownloading(true);
    try {
      await downloadRef.current();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary bar + view toggle */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <CheckCircle className="size-3 text-green-600" />
            {stats.complete} complete
          </span>
          <span className="flex items-center gap-1">
            <Circle className="size-3 text-amber-500" />
            {stats.partial} partial
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="size-3 text-red-600" />
            {stats.risk} risks
          </span>
          <span className="flex items-center gap-1">
            <HelpCircle className="size-3 text-muted-foreground/40" />
            {stats.unknown} unknown
          </span>
        </div>
        <div className="flex-1" />
        <span className="text-muted-foreground">{completionPct}% coverage</span>
        {view === "graph" && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-md border px-2 py-1 transition-colors hover:bg-muted/50 disabled:opacity-50"
            title="Download as SVG"
          >
            <Download className="size-3.5" />
          </button>
        )}
        <div className="flex items-center rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded px-2 py-1 transition-colors ${view === "list" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="List view"
          >
            <List className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setView("graph")}
            className={`rounded px-2 py-1 transition-colors ${view === "graph" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="Graph view"
          >
            <GitBranchPlus className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
        {stats.complete > 0 && (
          <div className="h-full bg-green-500" style={{ width: `${(stats.complete / stats.total) * 100}%` }} />
        )}
        {stats.partial > 0 && (
          <div className="h-full bg-amber-400" style={{ width: `${(stats.partial / stats.total) * 100}%` }} />
        )}
        {stats.risk > 0 && (
          <div className="h-full bg-red-500" style={{ width: `${(stats.risk / stats.total) * 100}%` }} />
        )}
      </div>

      {/* List view */}
      {view === "list" && (
        <div className="rounded-lg border">
          {roots.map((root) => (
            <ThesisNodeRow key={root.id} node={root} depth={0} portcoSlug={portcoSlug} dealId={dealId} />
          ))}
        </div>
      )}

      {/* Graph view */}
      {view === "graph" && <ThesisGraph roots={roots} downloadRef={downloadRef} companyName={companyName} />}
    </div>
  );
}
