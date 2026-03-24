import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { files, portcos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, FolderOpen } from "lucide-react";
import { ProcessIMButton } from "@/components/deals/process-im-button";
import { ImportGdriveDialog } from "@/components/deals/import-gdrive-dialog";
import { getDeal } from "@/lib/db/cached-queries";
import type { FileType } from "@/lib/db/schema/files";

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

const fileTypeBadgeColors: Record<string, string> = {
  im_pdf: "bg-blue-100 text-blue-700 border-blue-200",
  dd_financial: "bg-emerald-100 text-emerald-700 border-emerald-200",
  dd_legal: "bg-purple-100 text-purple-700 border-purple-200",
  dd_operational: "bg-orange-100 text-orange-700 border-orange-200",
  dd_tax: "bg-amber-100 text-amber-700 border-amber-200",
  dd_hr: "bg-pink-100 text-pink-700 border-pink-200",
  dd_it: "bg-cyan-100 text-cyan-700 border-cyan-200",
  nda: "bg-gray-100 text-gray-600 border-gray-200",
  loi: "bg-indigo-100 text-indigo-700 border-indigo-200",
  purchase_agreement: "bg-violet-100 text-violet-700 border-violet-200",
};

type FileGroup = {
  label: string;
  types: FileType[];
};

const FILE_GROUPS: FileGroup[] = [
  { label: "Information Memorandum", types: ["im_pdf"] },
  { label: "Due Diligence", types: ["dd_financial", "dd_legal", "dd_operational", "dd_tax", "dd_hr", "dd_it"] },
  { label: "Deal Documents", types: ["nda", "loi", "purchase_agreement"] },
  { label: "PMI", types: ["pmi_plan", "pmi_report"] },
  { label: "Other", types: ["report", "attachment", "other"] },
];

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ConfidenceDot({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const pct = Math.round(Number(confidence) * 100);
  const color =
    pct >= 80 ? "text-green-500" : pct >= 50 ? "text-amber-500" : "text-red-400";
  return (
    <span className={`text-[10px] ${color} shrink-0`} title={`Classification confidence: ${pct}%`}>
      {pct}%
    </span>
  );
}

export default async function FilesPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal, user] = await Promise.all([
    getDeal(dealId),
    getCurrentUser(),
  ]);

  if (!deal) notFound();

  const [portco, role, dealFiles] = await Promise.all([
    db
      .select({ id: portcos.id, gdriveTokenEnc: portcos.gdriveServiceAccountEnc })
      .from(portcos)
      .where(eq(portcos.id, deal.portcoId))
      .limit(1)
      .then((r) => r[0] ?? null),
    user ? getUserPortcoRole(user.id, deal.portcoId) : null,
    db
      .select()
      .from(files)
      .where(eq(files.dealId, dealId))
      .orderBy(files.createdAt),
  ]);

  const isGdriveConnected = Boolean(portco?.gdriveTokenEnc);
  const isAdmin = role ? hasMinRole(role as UserRole, "admin") : false;

  // Group files by category
  const groupedFiles = FILE_GROUPS.map((group) => {
    const typesSet = new Set<string>(group.types);
    return {
      ...group,
      files: dealFiles.filter((f) => typesSet.has(f.fileType ?? "other")),
    };
  }).filter((g) => g.files.length > 0);

  // Files with types not in any group
  const groupedTypeSet = new Set(FILE_GROUPS.flatMap((g) => g.types));
  const ungroupedFiles = dealFiles.filter(
    (f) => !f.fileType || !groupedTypeSet.has(f.fileType),
  );
  if (ungroupedFiles.length > 0) {
    groupedFiles.push({ label: "Uncategorized", types: [], files: ungroupedFiles });
  }

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
        <div className="space-y-5">
          {groupedFiles.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="size-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </h3>
                <span className="text-[10px] text-muted-foreground/60">{group.files.length}</span>
              </div>
              <div className="space-y-1">
                {group.files.map((file) => {
                  const isPdf = file.mimeType === "application/pdf";
                  const badgeColor =
                    fileTypeBadgeColors[file.fileType ?? ""] ?? "bg-gray-100 text-gray-600 border-gray-200";
                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(file.sizeBytes)}
                            {file.createdAt && ` · ${new Date(file.createdAt).toLocaleDateString()}`}
                          </span>
                          {file.gdriveParentPath && (
                            <span className="text-[10px] text-muted-foreground/50 truncate max-w-[200px]">
                              {file.gdriveParentPath}
                            </span>
                          )}
                        </div>
                      </div>
                      {file.fileType && (
                        <Badge className={`text-[10px] shrink-0 ${badgeColor}`}>
                          {fileTypeLabels[file.fileType] ?? file.fileType}
                        </Badge>
                      )}
                      {file.classifiedBy === "auto" && (
                        <ConfidenceDot confidence={file.classificationConfidence} />
                      )}
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
                      {isPdf && isAdmin && file.fileType === "im_pdf" && (
                        <ProcessIMButton
                          portcoSlug={portcoSlug}
                          fileId={file.id}
                          processingStatus={file.processingStatus}
                          fileName={file.fileName}
                        />
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
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {isGdriveConnected
              ? "No files yet. Use \"Import from GDrive\" to add documents."
              : "No files uploaded yet. Connect Google Drive in Settings to import documents."}
          </p>
        </div>
      )}
    </div>
  );
}
