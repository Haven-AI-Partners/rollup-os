"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, CheckCircle, XCircle, Loader2, TrendingDown, TrendingUp, Minus, ChevronRight, Clock } from "lucide-react";
import { triggerEvalRun } from "@/lib/actions/im-processing";
import { useRunStatus } from "@/hooks/use-run-status";
import { SCORING_DIMENSIONS } from "@/lib/scoring/rubric";
import { stdDevBadgeColor, flagAgreementBadgeColor } from "@/lib/constants";
import { formatDateTime, formatDuration } from "@/lib/format";

interface ProcessedFile {
  id: string;
  fileName: string;
  dealId: string | null;
  companyName: string;
}

interface EvalRun {
  id: string;
  fileName: string;
  iterations: number;
  status: string;
  overallScoreStdDev: string | null;
  flagAgreementRate: string | null;
  nameConsistent: string | null;
  scoreVariance: Record<string, number> | null;
  promptVersionLabel: string | null;
  modelId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface EvalPanelProps {
  portcoSlug: string;
  processedFiles: ProcessedFile[];
  evalRuns: EvalRun[];
  isAdmin: boolean;
}

function VarianceBadge({ value }: { value: number }) {
  if (value === 0) {
    return (
      <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 gap-0.5">
        <CheckCircle className="size-2.5" /> 0
      </Badge>
    );
  }
  if (value <= 0.3) {
    return (
      <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 gap-0.5">
        <Minus className="size-2.5" /> {value.toFixed(2)}
      </Badge>
    );
  }
  if (value <= 0.7) {
    return (
      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 gap-0.5">
        <TrendingUp className="size-2.5" /> {value.toFixed(2)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 gap-0.5">
      <TrendingDown className="size-2.5" /> {value.toFixed(2)}
    </Badge>
  );
}

function EvalRunRow({ run, dimNameMap }: { run: EvalRun; dimNameMap: Map<string, string> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => run.status === "completed" && setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {run.status === "completed" ? (
            <CheckCircle className="size-4 text-green-600 shrink-0" />
          ) : run.status === "failed" ? (
            <XCircle className="size-4 text-red-600 shrink-0" />
          ) : (
            <Loader2 className="size-4 text-blue-600 animate-spin shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{run.fileName}</span>
          <Badge variant="outline" className="text-[10px]">
            {run.iterations}x
          </Badge>
          {run.promptVersionLabel && (
            <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
              {run.promptVersionLabel}
            </Badge>
          )}
          {run.modelId && (
            <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200">
              {run.modelId}
            </Badge>
          )}
          {run.status === "completed" && run.overallScoreStdDev && (
            <Badge variant="outline" className={`text-[10px] ${stdDevBadgeColor(Number(run.overallScoreStdDev))}`}>
              ±{run.overallScoreStdDev}
            </Badge>
          )}
          {run.status === "completed" && run.flagAgreementRate && (
            <Badge variant="outline" className={`text-[10px] ${flagAgreementBadgeColor(Number(run.flagAgreementRate))}`}>
              {(Number(run.flagAgreementRate) * 100).toFixed(0)}% flags
            </Badge>
          )}
          {run.status === "completed" && run.completedAt && (
            <Badge variant="outline" className="text-[10px] gap-0.5">
              <Clock className="size-2.5" /> {formatDuration(new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime())}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-muted-foreground">
            {formatDateTime(run.createdAt)}
          </span>
          {run.status === "completed" && (
            <ChevronRight className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
          )}
        </div>
      </button>

      {expanded && run.status === "completed" && (
        <div className="px-3 pb-3 space-y-2 border-t">
          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded bg-muted/50 p-2">
              <p className="text-[10px] text-muted-foreground">Score Std Dev</p>
              <p className="text-sm font-semibold">
                {run.overallScoreStdDev ? `±${run.overallScoreStdDev}` : "—"}
              </p>
            </div>
            <div className="rounded bg-muted/50 p-2">
              <p className="text-[10px] text-muted-foreground">Flag Agreement</p>
              <p className="text-sm font-semibold">
                {run.flagAgreementRate
                  ? `${(Number(run.flagAgreementRate) * 100).toFixed(0)}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded bg-muted/50 p-2">
              <p className="text-[10px] text-muted-foreground">Name</p>
              <p className="text-sm font-semibold truncate" title={run.nameConsistent ?? undefined}>
                {run.nameConsistent && !run.nameConsistent.includes("variants")
                  ? "Consistent"
                  : run.nameConsistent ?? "—"}
              </p>
            </div>
          </div>

          {/* Per-dimension variance */}
          {run.scoreVariance && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Per-dimension std dev</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(run.scoreVariance).map(([dimId, variance]) => (
                  <div key={dimId} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30">
                    <span className="text-muted-foreground truncate mr-2">
                      {dimNameMap.get(dimId) ?? dimId}
                    </span>
                    <VarianceBadge value={variance} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EvalPanel({ portcoSlug, processedFiles, evalRuns, isAdmin }: EvalPanelProps) {
  const router = useRouter();
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [iterations, setIterations] = useState("3");
  const [running, setRunning] = useState(false);
  const [triggerRunId, setTriggerRunId] = useState<string | null>(null);

  const { state: runState } = useRunStatus(triggerRunId);

  // When the Trigger.dev run completes, refresh the page to show results
  useEffect(() => {
    if (runState === "completed" || runState === "failed") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync local state when async polling completes
      setRunning(false);
      setTriggerRunId(null);
      router.refresh();
    }
  }, [runState, router]);

  async function handleRunEval() {
    if (!selectedFileId) return;
    setRunning(true);
    try {
      const result = await triggerEvalRun(portcoSlug, selectedFileId, Number(iterations));
      setTriggerRunId(result.runId);
    } catch {
      setRunning(false);
    }
  }

  const dimNameMap = new Map(SCORING_DIMENSIONS.map((d) => [d.id, d.name]));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="size-5" />
          <div>
            <CardTitle className="text-base">Consistency Evals</CardTitle>
            <CardDescription>
              Process the same IM multiple times and measure variance in scores, red flags, and extraction
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Run new eval */}
        {isAdmin && processedFiles.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedFileId} onValueChange={setSelectedFileId}>
              <SelectTrigger className="flex-1 text-sm">
                <SelectValue placeholder="Select a processed file..." />
              </SelectTrigger>
              <SelectContent>
                {processedFiles.map((f) => (
                  <SelectItem key={f.id} value={f.id} className="text-sm">
                    {f.companyName} — {f.fileName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={iterations} onValueChange={setIterations}>
              <SelectTrigger className="w-[80px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3x</SelectItem>
                <SelectItem value="5">5x</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleRunEval}
              disabled={!selectedFileId || running}
              className="gap-1.5 shrink-0"
            >
              {running ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
              {running ? (triggerRunId ? "Running..." : "Starting...") : "Run Eval"}
            </Button>
          </div>
        )}

        {/* Eval results */}
        {evalRuns.length > 0 ? (
          <div className="space-y-1.5">
            {evalRuns.map((run) => (
              <EvalRunRow key={run.id} run={run} dimNameMap={dimNameMap} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No evals run yet. Select a processed file above to measure consistency.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
