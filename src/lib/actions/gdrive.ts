"use server";

import { getCurrentUser } from "@/lib/auth";
import { listFiles } from "@/lib/gdrive/client";

export async function getGdriveFiles(portcoId: string, pageToken?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const result = await listFiles(portcoId, 50, pageToken);
  if (!result) return null;

  return {
    files: result.files.map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "Untitled",
      mimeType: f.mimeType ?? "",
      size: f.size ?? null,
      modifiedTime: f.modifiedTime ?? null,
      webViewLink: f.webViewLink ?? null,
      iconLink: f.iconLink ?? null,
    })),
    nextPageToken: result.nextPageToken ?? null,
  };
}
