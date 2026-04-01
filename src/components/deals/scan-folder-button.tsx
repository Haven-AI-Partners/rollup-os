"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, FolderSearch, CheckCircle, XCircle } from "lucide-react";
import { scanGdriveFolder } from "@/lib/actions/im-processing";
import { useRunStatus } from "@/hooks/use-run-status";

interface ScanFolderButtonProps {
  portcoSlug: string;
}

export function ScanFolderButton({ portcoSlug }: ScanFolderButtonProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const { state, output, error: runError } = useRunStatus(runId);
  const router = useRouter();

  // Refresh page data when scan completes so new deals appear
  useEffect(() => {
    if (state === "completed") {
      router.refresh();
    }
  }, [state, router]);

  async function handleScan() {
    setRunId(null);
    setTriggerError(null);
    try {
      const res = await scanGdriveFolder(portcoSlug);
      setRunId(res.runId);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Failed to trigger scan");
    }
  }

  const isRunning = state === "running";
  const result = output as {
    totalFiles?: number;
    newFiles?: number;
    processed?: number;
    failed?: number;
  } | null;

  return (
    <div className="space-y-2">
      <Button onClick={handleScan} disabled={isRunning} className="gap-2">
        {isRunning ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Scanning...
          </>
        ) : (
          <>
            <FolderSearch className="size-4" />
            Scan Folder & Process IMs
          </>
        )}
      </Button>

      {triggerError && (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <XCircle className="size-4" />
          {triggerError}
        </div>
      )}

      {state === "failed" && (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <XCircle className="size-4" />
          Scan failed: {runError}
        </div>
      )}

      {state === "completed" && result && (
        <div className="flex items-center gap-1.5 text-sm text-green-700">
          <CheckCircle className="size-4" />
          Done: {result.processed ?? 0} processed, {result.newFiles ?? 0} new deals
          {(result.failed ?? 0) > 0 && (
            <span className="text-red-600 ml-1">({result.failed} failed)</span>
          )}
        </div>
      )}
    </div>
  );
}
