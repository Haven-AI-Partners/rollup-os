import { notFound } from "next/navigation";
import { getPortcoBySlug, getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { listFilesRecursive } from "@/lib/gdrive/scanner";
import { db } from "@/lib/db";
import { files as filesTable } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  HardDrive,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { ScanFolderButton } from "@/components/deals/scan-folder-button";
import { ReprocessAllButton } from "@/components/deals/reprocess-all-button";
import { VirtualFilesList } from "@/components/files/virtual-files-list";

const INITIAL_PAGE_SIZE = 50;

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
  const allFiles = isConnected ? await listFilesRecursive(portco.id) : [];
  const total = allFiles.length;

  // Only send the first page to the client for initial render
  const initialFiles = allFiles.slice(0, INITIAL_PAGE_SIZE).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
    parentPath: f.parentPath,
  }));

  // Cross-reference with DB for processing status
  const gdriveIds = initialFiles.map((f) => f.id).filter(Boolean);
  const processedFiles = gdriveIds.length > 0
    ? await db
        .select({ gdriveFileId: filesTable.gdriveFileId, processingStatus: filesTable.processingStatus, dealId: filesTable.dealId })
        .from(filesTable)
        .where(inArray(filesTable.gdriveFileId, gdriveIds))
    : [];
  const processedMap = Object.fromEntries(
    processedFiles.map((f) => [f.gdriveFileId, { status: f.processingStatus, dealId: f.dealId }])
  );

  const nextCursor = INITIAL_PAGE_SIZE < total ? INITIAL_PAGE_SIZE : null;

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
            {isAdmin && (
              <Button asChild variant="outline">
                <Link href={`/${portcoSlug}/settings/integrations`}>
                  <Settings className="mr-1 size-4" />
                  Go to Settings
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : allFiles.length > 0 ? (
        <VirtualFilesList
          portcoId={portco.id}
          portcoSlug={portcoSlug}
          isAdmin={isAdmin}
          initialData={{
            files: initialFiles,
            processedMap,
            nextCursor,
            total,
          }}
        />
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
