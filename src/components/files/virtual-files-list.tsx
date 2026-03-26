"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  FolderOpen,
  Image,
  FileSpreadsheet,
  Presentation,
  ExternalLink,
  CheckCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { ProcessGdriveFileButton } from "@/components/deals/process-gdrive-file-button";

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  parentPath: string;
}

export interface ProcessedInfo {
  status: string;
  dealId: string | null;
}

export interface PageData {
  files: GDriveFile[];
  processedMap: Record<string, ProcessedInfo>;
  nextCursor: number | null;
  total: number | null;
}

interface VirtualFilesListProps {
  portcoId: string;
  portcoSlug: string;
  isAdmin: boolean;
}

const ROW_HEIGHT = 64;
const OVERSCAN = 5;

const mimeIcons: Record<string, typeof FileText> = {
  "application/pdf": FileText,
  "application/vnd.google-apps.folder": FolderOpen,
  "application/vnd.google-apps.spreadsheet": FileSpreadsheet,
  "application/vnd.google-apps.presentation": Presentation,
  "application/vnd.google-apps.document": FileText,
  "image/png": Image,
  "image/jpeg": Image,
};

function getMimeLabel(mimeType: string) {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("folder")) return "Folder";
  if (mimeType.includes("spreadsheet")) return "Sheets";
  if (mimeType.includes("presentation")) return "Slides";
  if (mimeType.includes("document")) return "Doc";
  if (mimeType.startsWith("image/")) return "Image";
  return mimeType.split("/").pop() ?? "File";
}

function formatBytes(bytes: string | null) {
  if (!bytes) return null;
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function VirtualFilesList({
  portcoId,
  portcoSlug,
  isAdmin,
}: VirtualFilesListProps) {
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [processedMap, setProcessedMap] = useState<Record<string, ProcessedInfo>>({});
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [total, setTotal] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const fetchPage = useCallback(async (cursor: number) => {
    if (isFetching) return;

    setIsFetching(true);
    try {
      const res = await fetch(
        `/api/gdrive/files/paginated?portcoId=${encodeURIComponent(portcoId)}&cursor=${cursor}`,
      );
      if (!res.ok) return;

      const data: PageData = await res.json();
      setFiles((prev) => cursor === 0 ? data.files : [...prev, ...data.files]);
      setProcessedMap((prev) => cursor === 0 ? data.processedMap : { ...prev, ...data.processedMap });
      setNextCursor(data.nextCursor);
      setTotal(data.total);
    } catch {
      // Silently fail, user can scroll again to retry
    } finally {
      setIsFetching(false);
      setHasInitialLoad(true);
    }
  }, [isFetching, portcoId]);

  // Fetch the first page on mount
  useEffect(() => {
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portcoId]);

  // Fetch next page when user scrolls near the bottom
  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    if (items.length === 0 || nextCursor === null || isFetching) return;

    const lastItem = items[items.length - 1];
    if (lastItem.index >= files.length - 10) {
      fetchPage(nextCursor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualizer.getVirtualItems(), files.length, nextCursor, isFetching]);

  if (!hasInitialLoad) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0 && !isFetching) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <FolderOpen className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No files found in this folder.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        Showing {files.length} of {total ?? "..."} files
      </p>
      <div
        ref={parentRef}
        className="h-[calc(100vh-220px)] overflow-auto"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const file = files[virtualRow.index];
            if (!file) return null;

            const Icon = mimeIcons[file.mimeType] ?? FileText;
            const processed = processedMap[file.id];

            return (
              <div
                key={file.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <Card className="mb-2">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="rounded-md bg-muted p-2">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">
                          {getMimeLabel(file.mimeType)}
                        </Badge>
                        {file.parentPath && (
                          <span
                            className="text-xs text-muted-foreground truncate max-w-[200px]"
                            title={file.parentPath}
                          >
                            {file.parentPath}
                          </span>
                        )}
                        {formatBytes(file.size) && (
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(file.size)}
                          </span>
                        )}
                        {formatDate(file.modifiedTime) && (
                          <span className="text-xs text-muted-foreground">
                            Modified {formatDate(file.modifiedTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    {processed?.status === "completed" ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/${portcoSlug}/pipeline/${processed.dealId}`}>
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle className="mr-1 size-3" /> Processed
                          </Badge>
                        </Link>
                        {isAdmin && (
                          <ProcessGdriveFileButton
                            portcoSlug={portcoSlug}
                            gdriveFileId={file.id}
                            fileName={file.name}
                            mimeType={file.mimeType}
                            sizeBytes={file.size ? Number(file.size) : null}
                            webViewLink={file.webViewLink}
                            gdriveModifiedTime={file.modifiedTime}
                            force
                          />
                        )}
                      </div>
                    ) : isAdmin && file.mimeType === "application/pdf" ? (
                      <ProcessGdriveFileButton
                        portcoSlug={portcoSlug}
                        gdriveFileId={file.id}
                        fileName={file.name}
                        mimeType={file.mimeType}
                        sizeBytes={file.size ? Number(file.size) : null}
                        webViewLink={file.webViewLink}
                        gdriveModifiedTime={file.modifiedTime}
                      />
                    ) : null}
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button variant="ghost" size="icon" className="size-8">
                          <ExternalLink className="size-3.5" />
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
        {isFetching && (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
