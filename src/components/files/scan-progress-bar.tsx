"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderSearch, CheckCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

interface ScanProgress {
  totalFolders: number;
  scannedFolders: number;
  cachedFiles: number;
  scanInProgress: boolean;
  lastCompleteScanAt: string | null;
}

const POLL_INTERVAL_MS = 3_000;

export function ScanProgressBar({ portcoId }: { portcoId: string }) {
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/gdrive/scan-progress?portcoId=${encodeURIComponent(portcoId)}`,
      );
      if (!res.ok) return;
      const data: ScanProgress = await res.json();
      setProgress(data);
      return data;
    } catch {
      // Silently fail, will retry on next poll
    }
  }, [portcoId]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const data = await fetchProgress();
      if (cancelled) return;
      if (data?.scanInProgress) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchProgress]);

  // Nothing to show yet
  if (!progress) return null;
  if (progress.totalFolders === 0 && !progress.lastCompleteScanAt) return null;

  const { totalFolders, scannedFolders, cachedFiles, scanInProgress, lastCompleteScanAt } = progress;
  const pct = totalFolders > 0 ? Math.round((scannedFolders / totalFolders) * 100) : 0;

  if (scanInProgress) {
    return (
      <div className="rounded-lg border bg-muted/50 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <FolderSearch className="size-4 text-muted-foreground animate-pulse" />
          <span>
            Scanning: {scannedFolders}/{totalFolders} folders
            <span className="text-muted-foreground ml-1">
              ({cachedFiles.toLocaleString()} files found)
            </span>
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <CheckCircle className="size-3.5" />
      <span>
        {cachedFiles.toLocaleString()} files
        {lastCompleteScanAt && ` · Last scanned ${formatRelativeTime(lastCompleteScanAt)}`}
      </span>
    </div>
  );
}
