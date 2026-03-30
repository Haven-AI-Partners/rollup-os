"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  FolderTree,
  List,
  Loader2,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { FileRowContent } from "./file-row";
import { FILE_TYPE_LABELS } from "@/lib/constants";
import { FolderFilesList } from "./folder-files-list";

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
  fileType: string | null;
  classificationConfidence: string | null;
  classifiedBy: string | null;
}

export interface PageData {
  files: GDriveFile[];
  processedMap: Record<string, ProcessedInfo>;
  nextCursor: number | null;
  total: number | null;
  syncing?: boolean;
}

interface VirtualFilesListProps {
  portcoId: string;
  portcoSlug: string;
  isAdmin: boolean;
}

const ROW_HEIGHT = 64;
const OVERSCAN = 5;
const UNCLASSIFIED_KEY = "unclassified";

const FILE_TYPE_PILL_ORDER = [
  "im_pdf", "nda", "loi", "purchase_agreement",
  "dd_financial", "dd_legal", "dd_operational", "dd_tax", "dd_hr", "dd_it",
  "report", "attachment", "pmi_plan", "pmi_report", "other",
];

export function VirtualFilesList({
  portcoId,
  portcoSlug,
  isAdmin,
}: VirtualFilesListProps) {
  const [viewMode, setViewMode] = useState<"list" | "folder">("list");
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [processedMap, setProcessedMap] = useState<Record<string, ProcessedInfo>>({});
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [total, setTotal] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<string>>(new Set(["im_pdf"]));
  const [searchQuery, setSearchQuery] = useState("");

  const parentRef = useRef<HTMLDivElement>(null);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      const fileType = processedMap[file.id]?.fileType ?? UNCLASSIFIED_KEY;
      counts.set(fileType, (counts.get(fileType) ?? 0) + 1);
    }
    return counts;
  }, [files, processedMap]);

  const filteredFiles = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return files.filter((file) => {
      if (activeTypeFilters.size > 0) {
        const fileType = processedMap[file.id]?.fileType ?? UNCLASSIFIED_KEY;
        if (!activeTypeFilters.has(fileType)) return false;
      }
      if (query) {
        const nameMatch = file.name.toLowerCase().includes(query);
        const pathMatch = file.parentPath?.toLowerCase().includes(query);
        if (!nameMatch && !pathMatch) return false;
      }
      return true;
    });
  }, [files, processedMap, activeTypeFilters, searchQuery]);

  const virtualizer = useVirtualizer({
    count: filteredFiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const syncRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async (cursor: number, mode: "list" | "folder" = "list") => {
    if (isFetching) return;

    setIsFetching(true);
    try {
      const params = new URLSearchParams({
        portcoId,
        cursor: String(cursor),
        ...(mode === "folder" ? { mode: "folder" } : {}),
      });
      const res = await fetch(`/api/gdrive/files/paginated?${params}`);
      if (!res.ok) return;

      const data: PageData = await res.json();

      if (data.syncing) {
        setIsSyncing(true);
        syncRetryRef.current = setTimeout(() => fetchPage(0, mode), 3000);
        return;
      }

      setIsSyncing(false);
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

  // Clean up sync retry timer on unmount
  useEffect(() => {
    return () => {
      if (syncRetryRef.current) clearTimeout(syncRetryRef.current);
    };
  }, []);

  // Fetch data on mount and when view mode changes
  useEffect(() => {
    setFiles([]);
    setProcessedMap({});
    setNextCursor(0);
    setTotal(null);
    setHasInitialLoad(false);
    fetchPage(0, viewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portcoId, viewMode]);

  // Fetch next page when user scrolls near the bottom
  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    if (items.length === 0 || nextCursor === null || isFetching) return;

    const lastItem = items[items.length - 1];
    if (lastItem.index >= filteredFiles.length - 10) {
      fetchPage(nextCursor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualizer.getVirtualItems(), filteredFiles.length, nextCursor, isFetching]);

  if (!hasInitialLoad && isSyncing) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        {isSyncing && (
          <p className="text-sm text-muted-foreground">
            Syncing files from Google Drive...
          </p>
        )}
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

  const isFiltered = activeTypeFilters.size > 0 || searchQuery.trim().length > 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded px-2 py-1 transition-colors ${viewMode === "list" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="List view"
          >
            <List className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("folder")}
            className={`rounded px-2 py-1 transition-colors ${viewMode === "folder" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="Folder view"
          >
            <FolderTree className="size-3.5" />
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Showing {filteredFiles.length}{isFiltered ? " (filtered)" : ""} of {total ?? "..."} files
      </p>
      {typeCounts.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {FILE_TYPE_PILL_ORDER
            .filter((type) => typeCounts.has(type))
            .concat(
              [...typeCounts.keys()].filter(
                (k) => k !== UNCLASSIFIED_KEY && !FILE_TYPE_PILL_ORDER.includes(k),
              ),
            )
            .map((type) => {
              const isActive = activeTypeFilters.has(type);
              return (
                <Button
                  key={type}
                  variant={isActive ? "default" : "outline"}
                  size="xs"
                  onClick={() => {
                    setActiveTypeFilters((prev) => {
                      const next = new Set(prev);
                      if (next.has(type)) {
                        next.delete(type);
                      } else {
                        next.add(type);
                      }
                      return next;
                    });
                  }}
                  className="rounded-full"
                >
                  {FILE_TYPE_LABELS[type] ?? type}
                  <span className="ml-1 text-[10px] opacity-70">{typeCounts.get(type)}</span>
                </Button>
              );
            })}
          {typeCounts.has(UNCLASSIFIED_KEY) && (
            <Button
              variant={activeTypeFilters.has(UNCLASSIFIED_KEY) ? "default" : "outline"}
              size="xs"
              onClick={() => {
                setActiveTypeFilters((prev) => {
                  const next = new Set(prev);
                  if (next.has(UNCLASSIFIED_KEY)) {
                    next.delete(UNCLASSIFIED_KEY);
                  } else {
                    next.add(UNCLASSIFIED_KEY);
                  }
                  return next;
                });
              }}
              className="rounded-full"
            >
              Unclassified
              <span className="ml-1 text-[10px] opacity-70">
                {typeCounts.get(UNCLASSIFIED_KEY)}
              </span>
            </Button>
          )}
          {activeTypeFilters.size < typeCounts.size && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setActiveTypeFilters(new Set(typeCounts.keys()))}
              className="text-muted-foreground"
            >
              Select All
            </Button>
          )}
          {activeTypeFilters.size > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setActiveTypeFilters(new Set())}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      )}
      {viewMode === "folder" ? (
        <FolderFilesList
          files={filteredFiles}
          processedMap={processedMap}
          portcoSlug={portcoSlug}
          isAdmin={isAdmin}
          hasMore={nextCursor !== null}
          isFetching={isFetching}
          onLoadMore={() => {
            if (nextCursor !== null && !isFetching) {
              fetchPage(nextCursor, "folder");
            }
          }}
        />
      ) : (
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
              const file = filteredFiles[virtualRow.index];
              if (!file) return null;

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
                      <FileRowContent
                        file={file}
                        processed={processed}
                        portcoSlug={portcoSlug}
                        isAdmin={isAdmin}
                      />
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
      )}
    </div>
  );
}
