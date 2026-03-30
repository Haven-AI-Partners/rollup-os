"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  FileText,
  FolderOpen,
  Image,
  FileSpreadsheet,
  Presentation,
  ExternalLink,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { FILE_TYPE_LABELS } from "@/lib/constants";
import { ProcessGdriveFileButton } from "@/components/deals/process-gdrive-file-button";
import type { GDriveFile, ProcessedInfo } from "./virtual-files-list";

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

export { FILE_TYPE_LABELS } from "@/lib/constants";

export function formatBytes(bytes: string | null) {
  if (!bytes) return null;
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface FileRowContentProps {
  file: GDriveFile;
  processed: ProcessedInfo | undefined;
  portcoSlug: string;
  isAdmin: boolean;
  showParentPath?: boolean;
}

export function FileRowContent({
  file,
  processed,
  portcoSlug,
  isAdmin,
  showParentPath = true,
}: FileRowContentProps) {
  const Icon = mimeIcons[file.mimeType] ?? FileText;

  return (
    <>
      <div className="rounded-md bg-muted p-2">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-[10px]">
            {getMimeLabel(file.mimeType)}
          </Badge>
          {showParentPath && file.parentPath && (
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
      {processed?.fileType && (
        processed.classifiedBy === "auto" && processed.classificationConfidence ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-[10px] shrink-0 cursor-default">
                {FILE_TYPE_LABELS[processed.fileType] ?? processed.fileType}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Confidence score: {Math.round(Number(processed.classificationConfidence) * 100)}%
            </TooltipContent>
          </Tooltip>
        ) : (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {FILE_TYPE_LABELS[processed.fileType] ?? processed.fileType}
          </Badge>
        )
      )}
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
    </>
  );
}
