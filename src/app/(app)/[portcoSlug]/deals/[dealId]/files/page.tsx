import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals, files, portcos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import { ProcessIMButton } from "@/components/deals/process-im-button";
import { ImportGdriveDialog } from "@/components/deals/import-gdrive-dialog";

const fileTypeLabels: Record<string, string> = {
  im_pdf: "IM",
  report: "Report",
  attachment: "Attachment",
  nda: "NDA",
  dd_financial: "DD Financial",
  dd_legal: "DD Legal",
  dd_operational: "DD Operational",
  dd_tax: "DD Tax",
  dd_hr: "DD HR",
  dd_it: "DD IT",
  loi: "LOI",
  purchase_agreement: "Purchase Agreement",
  pmi_plan: "PMI Plan",
  pmi_report: "PMI Report",
  other: "Other",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function FilesPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) notFound();

  const [portco] = await db
    .select({ id: portcos.id, gdriveTokenEnc: portcos.gdriveServiceAccountEnc })
    .from(portcos)
    .where(eq(portcos.id, deal.portcoId))
    .limit(1);

  const isGdriveConnected = Boolean(portco?.gdriveTokenEnc);

  // Check user role for admin actions
  const user = await getCurrentUser();
  const role = user ? await getUserPortcoRole(user.id, deal.portcoId) : null;
  const isAdmin = role ? hasMinRole(role as UserRole, "admin") : false;

  const dealFiles = await db
    .select()
    .from(files)
    .where(eq(files.dealId, dealId))
    .orderBy(files.createdAt);

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Files</h2>
        {isGdriveConnected && isAdmin && (
          <ImportGdriveDialog
            portcoSlug={portcoSlug}
            dealId={dealId}
            portcoId={deal.portcoId}
          />
        )}
      </div>
      {dealFiles.length > 0 ? (
        <div className="space-y-1">
          {dealFiles.map((file) => {
            const isPdf = file.mimeType === "application/pdf";
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.sizeBytes)}
                    {file.createdAt && ` · ${new Date(file.createdAt).toLocaleDateString()}`}
                  </p>
                </div>
                {file.fileType && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {fileTypeLabels[file.fileType] ?? file.fileType}
                  </Badge>
                )}
                {isPdf && isAdmin && (
                  <ProcessIMButton
                    portcoSlug={portcoSlug}
                    fileId={file.id}
                    processingStatus={file.processingStatus}
                    fileName={file.fileName}
                  />
                )}
                {isPdf && !isAdmin && (
                  <Badge
                    variant={
                      file.processingStatus === "completed"
                        ? "secondary"
                        : file.processingStatus === "failed"
                          ? "destructive"
                          : "outline"
                    }
                    className="text-[10px] shrink-0 capitalize"
                  >
                    {file.processingStatus}
                  </Badge>
                )}
                {!isPdf && (
                  <Badge
                    variant={
                      file.processingStatus === "completed"
                        ? "secondary"
                        : file.processingStatus === "failed"
                          ? "destructive"
                          : "outline"
                    }
                    className="text-[10px] shrink-0 capitalize"
                  >
                    {file.processingStatus}
                  </Badge>
                )}
                {file.gdriveUrl && (
                  <a
                    href={file.gdriveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {isGdriveConnected
              ? "No files yet. Use \"Import from GDrive\" to add IM documents."
              : "No files uploaded yet. Connect Google Drive in Settings to import IM documents."}
          </p>
        </div>
      )}
    </div>
  );
}
