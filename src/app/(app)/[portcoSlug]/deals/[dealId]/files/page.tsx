import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals, files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";

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
  const { dealId } = await params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) notFound();

  const dealFiles = await db
    .select()
    .from(files)
    .where(eq(files.dealId, dealId))
    .orderBy(files.createdAt);

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">Files</h2>
      {dealFiles.length > 0 ? (
        <div className="space-y-1">
          {dealFiles.map((file) => (
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
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No files uploaded yet. File uploads will be available when GDrive integration is configured.
          </p>
        </div>
      )}
    </div>
  );
}
