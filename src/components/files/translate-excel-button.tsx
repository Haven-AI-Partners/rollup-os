"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Languages, CheckCircle, Download } from "lucide-react";
import { translateExcel } from "@/lib/actions/im-processing";
import { useRunStatus } from "@/hooks/use-run-status";

interface TranslateExcelButtonProps {
  portcoSlug: string;
  gdriveFileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  webViewLink: string | null;
}

export function TranslateExcelButton({
  portcoSlug,
  gdriveFileId,
  fileName,
  mimeType,
  sizeBytes,
  webViewLink,
}: TranslateExcelButtonProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const { state, output, error: runError } = useRunStatus(runId);

  async function handleTranslate() {
    setRunId(null);
    setTriggerError(null);
    try {
      const res = await translateExcel(portcoSlug, gdriveFileId, fileName, mimeType, sizeBytes, webViewLink);
      setRunId(res.runId);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Failed to trigger");
    }
  }

  if (state === "running") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5 shrink-0">
        <Loader2 className="size-3.5 animate-spin" />
        Translating...
      </Button>
    );
  }

  if (state === "completed") {
    const result = output as { translatedFileUrl?: string; cellsTranslated?: number } | null;
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle className="size-3.5" />
          <span>{result?.cellsTranslated ?? 0} cells</span>
        </div>
        {result?.translatedFileUrl && (
          <a href={result.translatedFileUrl} download>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Download className="size-3" />
              Download
            </Button>
          </a>
        )}
      </div>
    );
  }

  if (state === "failed" || triggerError) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-red-600 max-w-[120px] truncate">
          {runError ?? triggerError}
        </span>
        <Button variant="outline" size="sm" onClick={handleTranslate} className="gap-1 text-xs">
          <Languages className="size-3" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTranslate}
      className="gap-1.5 shrink-0"
      title="Translate Japanese Excel file to English"
    >
      <Languages className="size-3.5" />
      Translate
    </Button>
  );
}
