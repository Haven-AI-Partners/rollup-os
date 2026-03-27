"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, Check, X, ExternalLink, User, FolderOpen, AlertTriangle } from "lucide-react";
import { updateGdriveFolderId, disconnectGdrive } from "@/lib/actions/settings";
import { formatRelativeTime } from "@/lib/format";

interface GdriveApiError {
  id: string;
  httpStatus: number;
  context: string;
  attempt: number;
  exhausted: boolean;
  createdAt: Date;
}

interface GdriveSettingsProps {
  portcoSlug: string;
  isConnected: boolean;
  folderId: string | null;
  folderName: string | null;
  accountEmail: string | null;
  accountName: string | null;
  recentErrors?: GdriveApiError[];
}

export function GdriveSettings({ portcoSlug, isConnected, folderId, folderName, accountEmail, accountName, recentErrors = [] }: GdriveSettingsProps) {
  const [folderIdInput, setFolderIdInput] = useState(folderId ?? "");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  async function handleSaveFolder(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGdriveFolderId(portcoSlug, folderIdInput.trim() || null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectGdrive(portcoSlug);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="size-5" />
            <div>
              <CardTitle className="text-base">Google Drive</CardTitle>
              <CardDescription>Connect Google Drive to browse and process IMs</CardDescription>
            </div>
          </div>
          {isConnected ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <Check className="mr-1 size-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <X className="mr-1 size-3" /> Not connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            {/* Connected account */}
            {accountEmail && (
              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                <User className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{accountName ?? accountEmail}</p>
                  {accountName && (
                    <p className="text-xs text-muted-foreground">{accountEmail}</p>
                  )}
                </div>
              </div>
            )}

            {recentErrors.length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 text-destructive shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      Google Drive API errors detected
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {recentErrors.filter((e) => e.exhausted).length > 0
                        ? "Rate limit errors are causing API calls to fail. Files may not be syncing correctly."
                        : "Rate limit retries are occurring. Sync may be slower than usual."}
                    </p>
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium text-muted-foreground">
                        {recentErrors.length} error{recentErrors.length !== 1 ? "s" : ""} in the last 24 hours
                      </summary>
                      <ul className="mt-1 space-y-1 pl-2">
                        {recentErrors.slice(0, 10).map((err) => (
                          <li key={err.id} className="text-muted-foreground">
                            HTTP {err.httpStatus} on {err.context}
                            {err.exhausted && " (failed)"} — {formatRelativeTime(err.createdAt)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveFolder} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="folderId" className="text-sm">Root Folder</Label>
                {folderName && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <FolderOpen className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{folderName}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  The Google Drive folder ID to scope file browsing. Leave empty to show all files.
                </p>
                <div className="flex gap-2">
                  <Input
                    id="folderId"
                    value={folderIdInput}
                    onChange={(e) => setFolderIdInput(e.target.value)}
                    placeholder="e.g. 1aasgqTxiKeCnRg9nPlATXl0pqzXdRIBM"
                    className="text-sm font-mono text-xs"
                  />
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </form>
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Connected via OAuth. Token encrypted at rest.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm text-muted-foreground text-center">
              Connect a Google account to browse IMs and deal documents from Google Drive.
            </p>
            <Button
              disabled={connecting}
              onClick={async () => {
                setConnecting(true);
                try {
                  const res = await fetch(`/api/auth/gdrive/connect?portcoSlug=${portcoSlug}`);
                  const { url } = await res.json();
                  window.location.href = url;
                } catch {
                  setConnecting(false);
                }
              }}
            >
              <ExternalLink className="mr-1 size-4" />
              {connecting ? "Connecting..." : "Connect Google Drive"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
