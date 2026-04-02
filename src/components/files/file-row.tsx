"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  FileText,
  ExternalLink,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { FILE_TYPE_LABELS, MIME_TYPE_ICONS } from "@/lib/constants";
import { formatBytes, formatDateWithYear } from "@/lib/format";
import { ProcessGdriveFileButton } from "@/components/deals/process-gdrive-file-button";
import { TranslateExcelButton } from "@/components/files/translate-excel-button";
import type { GDriveFile, ProcessedInfo } from "./virtual-files-list";

const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.spreadsheet",
]);

function getMimeLabel(mimeType: string) {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("folder")) return "Folder";
  if (mimeType.includes("spreadsheet")) return "Sheets";
  if (mimeType.includes("presentation")) return "Slides";
  if (mimeType.includes("document")) return "Doc";
  if (mimeType.startsWith("image/")) return "Image";
  return mimeType.split("/").pop() ?? "File";
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
  const Icon = MIME_TYPE_ICONS[file.mimeType] ?? FileText;

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
          {file.modifiedTime && (
            <span className="text-xs text-muted-foreground">
              Modified {formatDateWithYear(file.modifiedTime)}
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
      {processed?.status === "completed" && processed.fileType === "excel_data" ? (
        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="mr-1 size-3" /> Translated
          </Badge>
          {isAdmin && (
            <TranslateExcelButton
              portcoSlug={portcoSlug}
              gdriveFileId={file.id}
              fileName={file.name}
              mimeType={file.mimeType}
              sizeBytes={file.size ? Number(file.size) : null}
              webViewLink={file.webViewLink}
            />
          )}
        </div>
      ) : processed?.status === "completed" ? (
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
      ) : isAdmin && EXCEL_MIME_TYPES.has(file.mimeType) ? (
        <TranslateExcelButton
          portcoSlug={portcoSlug}
          gdriveFileId={file.id}
          fileName={file.name}
          mimeType={file.mimeType}
          sizeBytes={file.size ? Number(file.size) : null}
          webViewLink={file.webViewLink}
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
