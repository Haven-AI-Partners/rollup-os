"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Plus, Check, X, Undo2 } from "lucide-react";
import {
  RED_FLAG_DEFINITIONS,
  SEVERITY_CONFIG,
  CATEGORY_LABELS,
  DECISION_FRAMEWORK,
  type RedFlagSeverity,
} from "@/lib/scoring/red-flags";
import { addRedFlag, resolveRedFlag, unresolveRedFlag, removeRedFlag } from "@/lib/actions/red-flags";
import { SEVERITY_ICONS } from "@/lib/constants";

interface FlagRecord {
  id: string;
  flagId: string;
  severity: string;
  category: string;
  notes: string | null;
  resolved: boolean;
}

interface RedFlagsPanelProps {
  dealId: string;
  portcoId: string;
  portcoSlug: string;
  initialFlags: FlagRecord[];
}

export function RedFlagsPanel({ dealId, portcoId, portcoSlug, initialFlags }: RedFlagsPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState("");
  const [loading, setLoading] = useState(false);

  const activeFlags = initialFlags.filter((f) => !f.resolved);
  const resolvedFlags = initialFlags.filter((f) => f.resolved);

  // Count by severity
  const counts: Record<string, number> = {};
  for (const f of activeFlags) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }

  // Already-flagged IDs
  const flaggedIds = new Set(initialFlags.map((f) => f.flagId));
  const availableFlags = RED_FLAG_DEFINITIONS.filter((d) => !flaggedIds.has(d.id));

  async function handleAdd() {
    const def = RED_FLAG_DEFINITIONS.find((d) => d.id === selectedFlag);
    if (!def) return;
    setLoading(true);
    try {
      await addRedFlag(dealId, portcoId, portcoSlug, {
        flagId: def.id,
        severity: def.severity,
        category: def.category,
      });
      setSelectedFlag("");
      setShowAdd(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(flagRecordId: string) {
    await resolveRedFlag(flagRecordId, portcoSlug, dealId);
  }

  async function handleRemove(flagRecordId: string) {
    await removeRedFlag(flagRecordId, portcoSlug, dealId);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Red Flags Assessment</CardTitle>
          <div className="flex items-center gap-1">
            {(["critical", "serious", "moderate", "info_gap"] as const).map((sev) => {
              const count = counts[sev] ?? 0;
              if (count === 0) return null;
              const config = SEVERITY_CONFIG[sev];
              return (
                <Badge key={sev} variant="outline" className={`text-[10px] ${config.color}`}>
                  {count} {config.label}
                </Badge>
              );
            })}
            {activeFlags.length === 0 && (
              <Badge variant="outline" className="text-[10px] text-green-700">No flags</Badge>
            )}
          </div>
        </div>
        {/* Decision framework summary */}
        {(counts["critical"] ?? 0) >= 1 && (
          <p className="text-xs text-red-600 font-medium">{DECISION_FRAMEWORK.critical.action}</p>
        )}
        {(counts["serious"] ?? 0) >= 3 && !(counts["critical"] ?? 0) && (
          <p className="text-xs text-amber-600 font-medium">{DECISION_FRAMEWORK.serious.action}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Active flags */}
        {activeFlags.map((flag) => {
          const def = RED_FLAG_DEFINITIONS.find((d) => d.id === flag.flagId);
          const config = SEVERITY_CONFIG[flag.severity as RedFlagSeverity];
          const Icon = SEVERITY_ICONS[flag.severity] ?? AlertTriangle;
          return (
            <div key={flag.id} className={`rounded-md border p-2 ${config?.bgColor ?? ""}`}>
              <div className="flex items-start gap-2">
                <Icon className={`size-4 shrink-0 mt-0.5 ${config?.color ?? ""}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{def?.title ?? flag.flagId}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {CATEGORY_LABELS[flag.category as keyof typeof CATEGORY_LABELS] ?? flag.category}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => handleResolve(flag.id)}
                    title="Mark resolved"
                  >
                    <Check className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => handleRemove(flag.id)}
                    title="Remove"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 ml-6 mr-1">{def?.description ?? ""}</p>
              {flag.notes && (
                <p className="text-[10px] text-muted-foreground mt-1 italic ml-6 mr-1">{flag.notes}</p>
              )}
            </div>
          );
        })}

        {/* Resolved flags */}
        {resolvedFlags.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              {resolvedFlags.length} resolved flag{resolvedFlags.length !== 1 ? "s" : ""}
            </summary>
            <div className="mt-1 space-y-1">
              {resolvedFlags.map((flag) => {
                const def = RED_FLAG_DEFINITIONS.find((d) => d.id === flag.flagId);
                return (
                  <div key={flag.id} className="flex items-center gap-2 rounded-md border border-dashed p-2 opacity-60">
                    <Check className="size-3 text-green-600 shrink-0" />
                    <span className="flex-1 text-xs line-through">{def?.title ?? flag.flagId}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => unresolveRedFlag(flag.id, portcoSlug, dealId)}
                      title="Reopen"
                    >
                      <Undo2 className="size-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* Add flag */}
        {showAdd ? (
          <div className="flex gap-2 pt-1">
            <Select value={selectedFlag} onValueChange={setSelectedFlag}>
              <SelectTrigger className="flex-1 text-xs h-8">
                <SelectValue placeholder="Select a red flag..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {(["critical", "serious", "moderate", "info_gap"] as const).map((sev) => {
                  const flagsForSev = availableFlags.filter((f) => f.severity === sev);
                  if (flagsForSev.length === 0) return null;
                  return flagsForSev.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      <span className={SEVERITY_CONFIG[sev].color}>[{SEVERITY_CONFIG[sev].label}]</span>{" "}
                      {f.title}
                    </SelectItem>
                  ));
                })}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={handleAdd} disabled={!selectedFlag || loading}>
              Add
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="size-3 mr-1" />
            Flag Red Flag
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
