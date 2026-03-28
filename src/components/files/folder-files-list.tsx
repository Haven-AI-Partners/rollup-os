"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
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

interface FolderFilesListProps {
  files: GDriveFile[];
  processedMap: Record<string, ProcessedInfo>;
  portcoSlug: string;
  isAdmin: boolean;
}

export function FolderFilesList({
  files,
  processedMap,
  portcoSlug,
  isAdmin,
}: FolderFilesListProps) {
  const tree = useMemo(() => buildFolderTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand top-level folders
    return new Set(Array.from(tree.children.keys()));
  });

  function toggleFolder(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  const sortedChildren = Array.from(tree.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const sortedRootFiles = [...tree.files].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="rounded-lg border" data-testid="folder-files-list">
      {sortedChildren.map((child) => (
        <FolderRow
          key={child.fullPath}
          node={child}
          depth={0}
          expanded={expanded}
          onToggle={toggleFolder}
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
  );
}

function FolderRow({
  node,
  depth,
  expanded,
  onToggle,
  processedMap,
  portcoSlug,
  isAdmin,
}: {
  node: FolderNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  processedMap: Record<string, ProcessedInfo>;
  portcoSlug: string;
  isAdmin: boolean;
}) {
  const isExpanded = expanded.has(node.fullPath);
  const fileCount = countFilesRecursive(node);

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
