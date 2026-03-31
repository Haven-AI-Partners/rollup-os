"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Circle,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  List,
  GitBranchPlus,
  Download,
} from "lucide-react";
import type { ThesisStatus } from "@/lib/constants";
import { ThesisNodeRow } from "./thesis-node-row";
import { IssuesPanel } from "./thesis-issues-panel";

export interface ThesisNode {
  id: string;
  label: string;
  description: string | null;
  status: ThesisStatus;
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
  const showList = useCallback(() => setView("list"), []);
  const showGraph = useCallback(() => setView("graph"), []);

  const progressStyles = useMemo(() => ({
    complete: stats.total > 0 ? { width: `${(stats.complete / stats.total) * 100}%` } : undefined,
    partial: stats.total > 0 ? { width: `${(stats.partial / stats.total) * 100}%` } : undefined,
    risk: stats.total > 0 ? { width: `${(stats.risk / stats.total) * 100}%` } : undefined,
  }), [stats.complete, stats.partial, stats.risk, stats.total]);

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
    <div className="space-y-2">
      {/* Summary bar + view toggle */}
      <div className="flex items-center gap-2 sm:gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
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
            onClick={showList}
            className={`rounded px-2 py-1 transition-colors ${view === "list" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="List view"
          >
            <List className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={showGraph}
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
          <div className="h-full bg-green-500" style={progressStyles.complete} />
        )}
        {stats.partial > 0 && (
          <div className="h-full bg-amber-400" style={progressStyles.partial} />
        )}
        {stats.risk > 0 && (
          <div className="h-full bg-red-500" style={progressStyles.risk} />
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
      {view === "graph" && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <ThesisGraph roots={roots} downloadRef={downloadRef} companyName={companyName} />
          </div>
          <IssuesPanel roots={roots} />
        </div>
      )}
    </div>
  );
}
