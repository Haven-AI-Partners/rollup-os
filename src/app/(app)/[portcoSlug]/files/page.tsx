import { notFound } from "next/navigation";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { listFiles } from "@/lib/gdrive/client";
import { db } from "@/lib/db";
import { files as filesTable } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
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
  HardDrive,
  Settings,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { ScanFolderButton } from "@/components/deals/scan-folder-button";
import { ReprocessAllButton } from "@/components/deals/reprocess-all-button";
import { ProcessGdriveFileButton } from "@/components/deals/process-gdrive-file-button";

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

export default async function FilesPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);

  if (!portco) notFound();

  // Check user role for admin actions
  const user = await getCurrentUser();
  const role = user ? await getUserPortcoRole(user.id, portco.id) : null;
  const isAdmin = role ? hasMinRole(role as UserRole, "admin") : false;

  const isConnected = Boolean(portco.gdriveServiceAccountEnc);
  const raw = isConnected ? await listFiles(portco.id, 50) : null;
  const gdriveFiles = (raw?.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "Untitled",
    mimeType: f.mimeType ?? "",
    size: f.size ?? null,
    modifiedTime: f.modifiedTime ?? null,
    webViewLink: f.webViewLink ?? null,
  }));

  // Cross-reference with our DB to find already-processed files
  const gdriveIds = gdriveFiles.map((f) => f.id).filter(Boolean);
  const processedFiles = gdriveIds.length > 0
    ? await db
        .select({ gdriveFileId: filesTable.gdriveFileId, processingStatus: filesTable.processingStatus, dealId: filesTable.dealId })
        .from(filesTable)
        .where(inArray(filesTable.gdriveFileId, gdriveIds))
    : [];
  const processedMap = new Map(
    processedFiles.map((f) => [f.gdriveFileId, { status: f.processingStatus, dealId: f.dealId }])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-sm text-muted-foreground">
            {isConnected
              ? `Documents from Google Drive${portco.gdriveFolderId ? " (IMs folder)" : ""}`
              : "Connect Google Drive to browse files"}
          </p>
        </div>
        {isConnected && (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <HardDrive className="mr-1 size-3" /> GDrive Connected
          </Badge>
        )}
      </div>

      {isConnected && isAdmin && (
        <div className="flex items-center gap-3">
          <ScanFolderButton portcoSlug={portcoSlug} />
          <ReprocessAllButton portcoSlug={portcoSlug} />
        </div>
      )}

      {!isConnected ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <HardDrive className="size-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Google Drive not connected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect Google Drive in Settings to browse IMs and deal documents.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/${portcoSlug}/settings`}>
                <Settings className="mr-1 size-4" />
                Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : gdriveFiles.length > 0 ? (
        <div className="space-y-2">
          {gdriveFiles.map((file) => {
            const Icon = mimeIcons[file.mimeType] ?? FileText;
            const isFolder = file.mimeType === "application/vnd.google-apps.folder";
            const processed = processedMap.get(file.id);
            return (
              <Card key={file.id}>
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
                      {!isFolder && formatBytes(file.size) && (
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
                    <Link href={`/${portcoSlug}/pipeline/${processed.dealId}`}>
                      <Badge className="bg-green-100 text-green-800 border-green-200 shrink-0">
                        <CheckCircle className="mr-1 size-3" /> Processed
                      </Badge>
                    </Link>
                  ) : isAdmin && !isFolder && file.mimeType === "application/pdf" ? (
                    <ProcessGdriveFileButton
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FolderOpen className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No files found in this folder.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
