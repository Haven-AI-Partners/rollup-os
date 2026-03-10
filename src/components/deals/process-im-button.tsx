"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, CheckCircle, XCircle } from "lucide-react";
import { processIMFile } from "@/lib/actions/im-processing";
import { useRunStatus } from "@/hooks/use-run-status";

interface ProcessIMButtonProps {
  portcoSlug: string;
  fileId: string;
  processingStatus: string;
  fileName: string;
}

export function ProcessIMButton({
  portcoSlug,
  fileId,
  processingStatus,
  fileName,
}: ProcessIMButtonProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const { state, output, error: runError } = useRunStatus(runId);

  async function handleProcess() {
    setRunId(null);
    setTriggerError(null);
    try {
      const res = await processIMFile(portcoSlug, fileId);
      setRunId(res.runId);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Failed to trigger");
    }
  }

  if (processingStatus === "completed" && !runId) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-green-700">
          <CheckCircle className="size-3.5" />
          <span>Processed</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleProcess} className="gap-1 text-xs h-7">
          <Brain className="size-3" />
          Reprocess
        </Button>
      </div>
    );
  }

  if (state === "running") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5">
        <Loader2 className="size-3.5 animate-spin" />
        Analyzing...
      </Button>
    );
  }

  if (state === "completed") {
    const result = output as { overallScore?: number; redFlagCount?: number } | null;
    return (
      <div className="flex items-center gap-2 text-xs text-green-700">
        <CheckCircle className="size-3.5" />
        <span>
          {result?.overallScore !== undefined
            ? `Score: ${result.overallScore.toFixed(1)}`
            : "Processed"}
          {result?.redFlagCount ? ` | ${result.redFlagCount} flags` : ""}
        </span>
      </div>
    );
  }

  if (state === "failed" || triggerError) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-red-600">
          <XCircle className="size-3.5" />
          <span className="max-w-[160px] truncate">{runError ?? triggerError}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleProcess} className="gap-1.5">
          <Brain className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleProcess} className="gap-1.5">
      <Brain className="size-3.5" />
      Process IM
    </Button>
  );
}
