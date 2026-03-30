"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileRowContent } from "./file-row";
import type { GDriveFile, ProcessedInfo } from "./virtual-files-list";

export interface FolderNode {
  name: string;
  fullPath: string;
  children: Map<string, FolderNode>;
  files: GDriveFile[];
}

export function buildFolderTree(files: GDriveFile[]): FolderNode {
  const root: FolderNode = { name: "", fullPath: "", children: new Map(), files: [] };

  for (const file of files) {
    const path = file.parentPath?.trim();
    if (!path) {
      root.files.push(file);
      continue;
    }

    const segments = path.split("/").filter(Boolean);
    let current = root;
    let fullPath = "";

    for (const segment of segments) {
      fullPath = fullPath ? `${fullPath}/${segment}` : segment;
      let child = current.children.get(segment);
      if (!child) {
        child = { name: segment, fullPath, children: new Map(), files: [] };
        current.children.set(segment, child);
      }
      current = child;
    }

    current.files.push(file);
  }

  return root;
}

function countFilesRecursive(node: FolderNode): number {
  let count = node.files.length;
  for (const child of node.children.values()) {
    count += countFilesRecursive(child);
  }
  return count;
}

export function collectDescendantPaths(node: FolderNode): string[] {
  const paths: string[] = [];
  if (node.fullPath) paths.push(node.fullPath);
  for (const child of node.children.values()) {
    paths.push(...collectDescendantPaths(child));
  }
  return paths;
}

function allDescendantsExpanded(node: FolderNode, expanded: Set<string>): boolean {
  for (const child of node.children.values()) {
    if (!expanded.has(child.fullPath)) return false;
    if (!allDescendantsExpanded(child, expanded)) return false;
  }
  return true;
}

interface FolderFilesListProps {
  files: GDriveFile[];
  processedMap: Record<string, ProcessedInfo>;
  portcoSlug: string;
  isAdmin: boolean;
  hasMore: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
}

export function FolderFilesList({
  files,
  processedMap,
  portcoSlug,
  isAdmin,
  hasMore,
  isFetching,
  onLoadMore,
}: FolderFilesListProps) {
  const tree = useMemo(() => buildFolderTree(files), [files]);

  // Direct expanded set — initialized with top-level folders
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    return new Set(tree.children.keys());
  });

  // Re-initialize when tree changes (e.g. new files loaded)
  const prevTreeRef = useRef(tree);
  useEffect(() => {
    if (prevTreeRef.current !== tree) {
      prevTreeRef.current = tree;
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const key of tree.children.keys()) {
          if (!next.has(key)) next.add(key);
        }
        return next;
      });
    }
  }, [tree]);

  const allPaths = useMemo(() => collectDescendantPaths(tree), [tree]);
  const allExpanded = allPaths.length > 0 && allPaths.every((p) => expanded.has(p));

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetching) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetching, onLoadMore]);

  const toggleFolder = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandDescendants = useCallback((paths: string[]) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const p of paths) next.add(p);
      return next;
    });
  }, []);

  const collapseDescendants = useCallback((paths: string[]) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const p of paths) next.delete(p);
      return next;
    });
  }, []);

  const sortedChildren = Array.from(tree.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const sortedRootFiles = [...tree.files].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="h-[calc(100vh-220px)] overflow-auto">
      {sortedChildren.length > 0 && (
        <div className="flex justify-end mb-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              allExpanded
                ? collapseDescendants(allPaths)
                : expandDescendants(allPaths)
            }
            className="text-muted-foreground gap-1"
            data-testid="global-expand-toggle"
          >
            {allExpanded ? (
              <>
                <ChevronsUp className="size-3" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronsDown className="size-3" />
                Expand All
              </>
            )}
          </Button>
        </div>
      )}
      <div className="rounded-lg border" data-testid="folder-files-list">
        {sortedChildren.map((child) => (
          <FolderRow
            key={child.fullPath}
            node={child}
            depth={0}
            expanded={expanded}
            onToggle={toggleFolder}
            onExpandDescendants={expandDescendants}
            onCollapseDescendants={collapseDescendants}
            processedMap={processedMap}
            portcoSlug={portcoSlug}
            isAdmin={isAdmin}
          />
        ))}
        {sortedRootFiles.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            depth={0}
            processed={processedMap[file.id]}
            portcoSlug={portcoSlug}
            isAdmin={isAdmin}
          />
        ))}
      </div>
      {isFetching && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {hasMore && !isFetching && (
        <div ref={sentinelRef} className="h-1" />
      )}
    </div>
  );
}

function FolderRow({
  node,
  depth,
  expanded,
  onToggle,
  onExpandDescendants,
  onCollapseDescendants,
  processedMap,
  portcoSlug,
  isAdmin,
}: {
  node: FolderNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onExpandDescendants: (paths: string[]) => void;
  onCollapseDescendants: (paths: string[]) => void;
  processedMap: Record<string, ProcessedInfo>;
  portcoSlug: string;
  isAdmin: boolean;
}) {
  const isExpanded = expanded.has(node.fullPath);
  const fileCount = countFilesRecursive(node);
  const hasSubfolders = node.children.size > 0;
  const descendantsAllExpanded = hasSubfolders && allDescendantsExpanded(node, expanded);

  const sortedChildren = Array.from(node.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const sortedFiles = [...node.files].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onToggle(node.fullPath)}
        data-testid={`folder-${node.fullPath}`}
      >
        <span className="shrink-0 p-0.5">
          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </span>
        <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">{node.name}</span>
        <span className="text-[10px] text-muted-foreground/60">{fileCount}</span>
        {hasSubfolders && (
          <button
            type="button"
            className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            title={descendantsAllExpanded ? "Collapse all subfolders" : "Expand all subfolders"}
            data-testid={`folder-expand-all-${node.fullPath}`}
            onClick={(e) => {
              e.stopPropagation();
              const paths = collectDescendantPaths(node);
              if (descendantsAllExpanded) {
                // Keep the folder itself expanded, collapse descendants only
                const childPaths = paths.filter((p) => p !== node.fullPath);
                onCollapseDescendants(childPaths);
              } else {
                onExpandDescendants(paths);
              }
            }}
          >
            {descendantsAllExpanded ? (
              <ChevronsUp className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronsDown className="size-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
      {isExpanded && (
        <>
          {sortedChildren.map((child) => (
            <FolderRow
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onExpandDescendants={onExpandDescendants}
              onCollapseDescendants={onCollapseDescendants}
              processedMap={processedMap}
              portcoSlug={portcoSlug}
              isAdmin={isAdmin}
            />
          ))}
          {sortedFiles.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              depth={depth + 1}
              processed={processedMap[file.id]}
              portcoSlug={portcoSlug}
              isAdmin={isAdmin}
            />
          ))}
        </>
      )}
    </div>
  );
}

function FileRow({
  file,
  depth,
  processed,
  portcoSlug,
  isAdmin,
}: {
  file: GDriveFile;
  depth: number;
  processed: ProcessedInfo | undefined;
  portcoSlug: string;
  isAdmin: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
      style={{ paddingLeft: `${depth * 20 + 28}px` }}
      data-testid={`file-${file.id}`}
    >
      <FileRowContent
        file={file}
        processed={processed}
        portcoSlug={portcoSlug}
        isAdmin={isAdmin}
        showParentPath={false}
      />
    </div>
  );
}
