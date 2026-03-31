"use client";

import { useState } from "react";
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
} from "lucide-react";
import { updateThesisNode } from "@/lib/actions/thesis";
import { THESIS_STATUS_CONFIG, type ThesisStatus } from "@/lib/constants";
import type { ThesisNode } from "./thesis-tree";

const STATUS_ICONS: Record<ThesisStatus, { icon: typeof HelpCircle; iconColor: string }> = {
  unknown: { icon: HelpCircle, iconColor: "text-muted-foreground/40" },
  partial: { icon: Circle, iconColor: "text-amber-500" },
  complete: { icon: CheckCircle, iconColor: "text-green-600" },
  risk: { icon: AlertTriangle, iconColor: "text-red-600" },
};

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

export function ThesisNodeRow({
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

  const iconCfg = STATUS_ICONS[node.status];
  const statusCfg = THESIS_STATUS_CONFIG[node.status];
  const StatusIcon = iconCfg.icon;
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

        <StatusIcon className={`size-4 shrink-0 mt-0.5 ${iconCfg.iconColor}`} />

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
          <Badge className={`text-[10px] shrink-0 ${statusCfg.badgeClass}`}>
            {statusCfg.label}
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
                {Object.entries(THESIS_STATUS_CONFIG).map(([key, cfg]) => (
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
