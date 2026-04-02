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

  if (state === "running") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5 h-7 text-xs">
        <Loader2 className="size-3 animate-spin" />
        Extracting...
      </Button>
    );
  }

  if (state === "completed") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-700">
        <CheckCircle className="size-3.5" />
        Extracted
      </div>
    );
  }

  if (state === "failed" || triggerError) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 truncate max-w-[120px]">{runError ?? triggerError}</span>
        <Button variant="outline" size="sm" onClick={handleExtract} className="gap-1 h-7 text-xs">
          <FileSearch className="size-3" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExtract}
      className="gap-1 h-7 text-xs"
      title="Extract and translate document content"
    >
      <FileSearch className="size-3" />
      Extract
    </Button>
  );
}
