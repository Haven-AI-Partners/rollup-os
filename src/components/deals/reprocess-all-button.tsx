"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { reprocessAllIMFiles } from "@/lib/actions/im-processing";
import { useRunStatus } from "@/hooks/use-run-status";

interface ReprocessAllButtonProps {
  portcoSlug: string;
}

export function ReprocessAllButton({ portcoSlug }: ReprocessAllButtonProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const { state, output, error: runError } = useRunStatus(runId);

  async function handleReprocess() {
    setRunId(null);
    setTriggerError(null);
    try {
      const res = await reprocessAllIMFiles(portcoSlug);
      setRunId(res.runId);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Failed to trigger");
    }
  }

  const isRunning = state === "running";
  const result = output as {
    total?: number;
    processed?: number;
    failed?: number;
  } | null;

  return (
    <div className="space-y-2">
      {isRunning ? (
        <Button variant="outline" disabled className="gap-2">
          <Loader2 className="size-4 animate-spin" />
          Reprocessing...
        </Button>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <RefreshCw className="size-4" />
              Reprocess All IMs
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reprocess all IM files?</AlertDialogTitle>
              <AlertDialogDescription>
                This will re-analyze all previously processed IM files using the current
                scoring rubric and red flag definitions. Existing profiles and red flags
                will be overwritten with fresh results.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReprocess}>
                Reprocess All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {triggerError && (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <XCircle className="size-4" />
          {triggerError}
        </div>
      )}

      {state === "failed" && (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <XCircle className="size-4" />
          Reprocessing failed: {runError}
        </div>
      )}

      {state === "completed" && result && (
        <div className="flex items-center gap-1.5 text-sm text-green-700">
          <CheckCircle className="size-4" />
          Done: {result.processed ?? 0}/{result.total ?? 0} reprocessed
          {(result.failed ?? 0) > 0 && (
            <span className="text-red-600 ml-1">({result.failed} failed)</span>
          )}
        </div>
      )}
    </div>
  );
}
