"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, FileText, Download, Brain } from "lucide-react";
import { importGdriveFile } from "@/lib/actions/im-processing";

interface GdriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
}

interface ImportGdriveDialogProps {
  portcoSlug: string;
  dealId: string;
  portcoId: string;
}

export function ImportGdriveDialog({
  portcoSlug,
  dealId,
  portcoId,
}: ImportGdriveDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gdriveFiles, setGdriveFiles] = useState<GdriveFile[]>([]);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadFiles();
    }
  }, [open]);

  async function loadFiles() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gdrive/files?portcoId=${portcoId}`);
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setGdriveFiles(data.files ?? []);
    } catch {
      setError("Failed to load Google Drive files");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(file: GdriveFile, autoProcess: boolean) {
    setImporting(file.id);
    try {
      await importGdriveFile(
        portcoSlug,
        dealId,
        file.id,
        file.name,
        file.mimeType,
        file.size ? Number(file.size) : null,
        file.webViewLink,
        autoProcess,
      );
      setOpen(false);
    } catch {
      setError("Failed to import file");
    } finally {
      setImporting(null);
    }
  }

  const isPdf = (mime: string) => mime === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FolderOpen className="size-3.5" />
          Import from GDrive
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import from Google Drive</DialogTitle>
          <DialogDescription>
            Select a file to import and optionally process with AI.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 py-4 text-center">{error}</p>
          )}
          {!loading && gdriveFiles.length === 0 && !error && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No files found in Google Drive folder.
            </p>
          )}
          {gdriveFiles.map((file) => {
            const isFolder = file.mimeType === "application/vnd.google-apps.folder";
            if (isFolder) return null;
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  {file.modifiedTime && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(file.modifiedTime).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {isPdf(file.mimeType) && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    PDF
                  </Badge>
                )}
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={importing === file.id}
                    onClick={() => handleImport(file, false)}
                    className="gap-1 text-xs"
                  >
                    {importing === file.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Download className="size-3" />
                    )}
                    Import
                  </Button>
                  {isPdf(file.mimeType) && (
                    <Button
                      variant="default"
                      size="sm"
                      disabled={importing === file.id}
                      onClick={() => handleImport(file, true)}
                      className="gap-1 text-xs"
                    >
                      {importing === file.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Brain className="size-3" />
                      )}
                      Process
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
