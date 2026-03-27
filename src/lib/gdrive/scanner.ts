import { getDriveClient } from "./client";
import { db } from "@/lib/db";
import { gdriveFileCache } from "@/lib/db/schema";
import { eq, sql, and, lt } from "drizzle-orm";

export interface GDriveFileWithPath {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  parentPath: string;
}

const MAX_DEPTH = 10;
const MAX_FILES = 10_000;
const FOLDER_MIME = "application/vnd.google-apps.folder";
const UPSERT_BATCH_SIZE = 500;

/**
 * Core BFS crawl. Stops after collecting `maxFiles` files.
 * Returns both the files found and whether the crawl completed fully.
 */
async function crawlFiles(
  portcoId: string,
  maxFiles: number,
): Promise<{ files: GDriveFileWithPath[]; complete: boolean }> {
  const result = await getDriveClient(portcoId);
  if (!result) return { files: [], complete: true };

  const { drive, folderId } = result;
  if (!folderId) return { files: [], complete: true };

  const allFiles: GDriveFileWithPath[] = [];
  const queue: Array<[string, string, number]> = [[folderId, "", 0]];

  while (queue.length > 0 && allFiles.length < maxFiles) {
    const [currentFolderId, currentPath, depth] = queue.shift()!;

    if (depth > MAX_DEPTH) continue;

    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed = false`,
        pageSize: 200,
        pageToken,
        fields:
          "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
        orderBy: "modifiedTime desc",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });

      for (const file of res.data.files ?? []) {
        if (!file.id || !file.name) continue;

        if (file.mimeType === FOLDER_MIME) {
          const subPath = currentPath
            ? `${currentPath}/${file.name}`
            : file.name;
          queue.push([file.id, subPath, depth + 1]);
        } else {
          allFiles.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType ?? "",
            size: file.size ?? null,
            modifiedTime: file.modifiedTime ?? null,
            webViewLink: file.webViewLink ?? null,
            parentPath: currentPath,
          });

          if (allFiles.length >= maxFiles) break;
        }
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && allFiles.length < maxFiles);
  }

  const complete = queue.length === 0 && allFiles.length < maxFiles;
  return { files: allFiles, complete };
}

/**
 * Full recursive crawl of GDrive. Used by scan tasks.
 */
export async function listFilesRecursive(
  portcoId: string,
): Promise<GDriveFileWithPath[]> {
  const { files } = await crawlFiles(portcoId, MAX_FILES);
  return files;
}

/**
 * Crawl GDrive and upsert all discovered files into the gdrive_file_cache table.
 * Removes rows for files no longer present in GDrive (lastSeenAt < scan start).
 */
export async function syncFilesToDb(
  portcoId: string,
  files: GDriveFileWithPath[],
): Promise<{ upserted: number; removed: number }> {
  const scanStart = new Date();
  let upserted = 0;

  // Batch upsert
  for (let i = 0; i < files.length; i += UPSERT_BATCH_SIZE) {
    const batch = files.slice(i, i + UPSERT_BATCH_SIZE);
    const values = batch.map((f) => ({
      portcoId,
      gdriveFileId: f.id,
      fileName: f.name,
      mimeType: f.mimeType,
      sizeBytes: f.size ? Number(f.size) : null,
      modifiedTime: f.modifiedTime ? new Date(f.modifiedTime) : null,
      webViewLink: f.webViewLink,
      parentPath: f.parentPath,
      lastSeenAt: scanStart,
    }));

    await db
      .insert(gdriveFileCache)
      .values(values)
      .onConflictDoUpdate({
        target: [gdriveFileCache.portcoId, gdriveFileCache.gdriveFileId],
        set: {
          fileName: sql`EXCLUDED.file_name`,
          mimeType: sql`EXCLUDED.mime_type`,
          sizeBytes: sql`EXCLUDED.size_bytes`,
          modifiedTime: sql`EXCLUDED.modified_time`,
          webViewLink: sql`EXCLUDED.web_view_link`,
          parentPath: sql`EXCLUDED.parent_path`,
          lastSeenAt: sql`EXCLUDED.last_seen_at`,
        },
      });

    upserted += batch.length;
  }

  // Remove files no longer in GDrive (not seen in this scan)
  const removeResult = await db
    .delete(gdriveFileCache)
    .where(
      and(
        eq(gdriveFileCache.portcoId, portcoId),
        lt(gdriveFileCache.lastSeenAt, scanStart),
      ),
    ) as unknown as { rowCount?: number };

  const removed = removeResult.rowCount ?? 0;

  return { upserted, removed };
}
