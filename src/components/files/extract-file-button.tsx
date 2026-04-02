"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, FileSearch, CheckCircle, XCircle } from "lucide-react";
import { extractFile } from "@/lib/actions/im-processing";
import { useRunStatus } from "@/hooks/use-run-status";

interface ExtractFileButtonProps {
  portcoSlug: string;
  fileId: string;
}

export function ExtractFileButton({ portcoSlug, fileId }: ExtractFileButtonProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const { state, error: runError } = useRunStatus(runId);
  const router = useRouter();

  useEffect(() => {
    if (state === "completed") {
      router.refresh();
    }
  }, [state, router]);

  async function handleExtract() {
    setRunId(null);
    setTriggerError(null);
    try {
      const res = await extractFile(portcoSlug, fileId);
      setRunId(res.runId);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Failed to trigger");
    }
  }

  const isRunning = state === "running";
  const isDone = state === "completed";
  const isFailed = state === "failed" || !!triggerError;
  const errorMsg = runError ?? triggerError;

  return (
    <div className="flex items-center gap-2">
      {isDone && (
        <span className="flex items-center gap-1.5 text-xs text-green-700">
          <CheckCircle className="size-3.5" />
          Extracted
        </span>
      )}
      {isFailed && (
        <span className="text-xs text-red-600 truncate max-w-[120px]">{errorMsg}</span>
      )}
      {!isDone && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleExtract}
          disabled={isRunning}
          className="gap-1 h-7 text-xs"
          title="Extract and translate document content"
        >
          {isRunning ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <FileSearch className="size-3" />
          )}
          {isRunning ? "Extracting..." : isFailed ? "Retry" : "Extract"}
        </Button>
      )}
    </div>
  );
}
