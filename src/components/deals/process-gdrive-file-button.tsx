"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, CheckCircle, XCircle } from "lucide-react";
import { processSingleFile } from "@/lib/actions/im-processing";
import { useRunStatus } from "@/hooks/use-run-status";

interface ProcessGdriveFileButtonProps {
  portcoSlug: string;
  gdriveFileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  webViewLink: string | null;
  force?: boolean;
}

export function ProcessGdriveFileButton({
  portcoSlug,
  gdriveFileId,
  fileName,
  mimeType,
  sizeBytes,
  webViewLink,
  force,
}: ProcessGdriveFileButtonProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const { state, output, error: runError } = useRunStatus(runId);

  async function handleProcess() {
    setRunId(null);
    setTriggerError(null);
    try {
      const res = await processSingleFile(portcoSlug, gdriveFileId, fileName, mimeType, sizeBytes, webViewLink, force);
      setRunId(res.runId);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Failed to trigger");
    }
  }

  if (state === "running") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5 shrink-0">
        <Loader2 className="size-3.5 animate-spin" />
        Processing...
      </Button>
    );
  }

  if (state === "completed") {
    const result = output as { success?: boolean; companyName?: string; overallScore?: number; error?: string } | null;
    if (result && result.success === false) {
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-red-600 max-w-[160px] truncate">
            {result.error ?? "Processing failed"}
          </span>
          <Button variant="outline" size="sm" onClick={handleProcess} className="gap-1 text-xs">
            <Brain className="size-3" />
            Retry
          </Button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-700 shrink-0">
        <CheckCircle className="size-3.5" />
        <span>
          {result?.overallScore !== undefined
            ? `${result.overallScore.toFixed(1)}/5`
            : "Done"}
        </span>
      </div>
    );
  }

  if (state === "failed" || triggerError) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-red-600 max-w-[120px] truncate">
          {runError ?? triggerError}
        </span>
        <Button variant="outline" size="sm" onClick={handleProcess} className="gap-1 text-xs">
          <Brain className="size-3" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleProcess} className="gap-1.5 shrink-0">
      <Brain className="size-3.5" />
      {force ? "Reprocess" : "Process"}
    </Button>
  );
}
