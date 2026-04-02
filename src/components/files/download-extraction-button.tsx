"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { getFileExtraction } from "@/lib/actions/file-extractions";
import {
  extractionToDownloadable,
  type ContentExtraction,
  type Translation,
} from "@/lib/extraction-download";

interface DownloadExtractionButtonProps {
  fileId: string;
  fileName: string;
}

export function DownloadExtractionButton({
  fileId,
  fileName,
}: DownloadExtractionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const extraction = await getFileExtraction(fileId);
      if (!extraction) return;

      const { filename, content, mimeType } = extractionToDownloadable(
        fileName,
        extraction.contentExtraction as ContentExtraction,
        extraction.translation as Translation | null,
      );

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }, [fileId, fileName]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      onClick={handleDownload}
      disabled={loading}
      title="Download as markdown"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Download className="size-3.5" />
      )}
    </Button>
  );
}
