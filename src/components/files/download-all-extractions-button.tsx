"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FolderDown, Loader2 } from "lucide-react";

interface DownloadAllExtractionsButtonProps {
  dealId: string;
  dealName: string;
  count: number;
}

export function DownloadAllExtractionsButton({
  dealId,
  dealName,
  count,
}: DownloadAllExtractionsButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/deals/${encodeURIComponent(dealId)}/extractions/download`,
      );
      if (!res.ok) return;

      const blob = await res.blob();
      const safeName = dealName.replace(/[^a-zA-Z0-9-_ ]/g, "") || "deal";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeName}-extractions.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }, [dealId, dealName]);

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="size-3.5 mr-1.5 animate-spin" />
      ) : (
        <FolderDown className="size-3.5 mr-1.5" />
      )}
      Download All ({count})
    </Button>
  );
}
