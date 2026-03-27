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

/** Upsert a batch of files into the gdrive_file_cache table. */
async function upsertBatch(
  portcoId: string,
  files: GDriveFileWithPath[],
  scanStart: Date,
): Promise<void> {
  if (files.length === 0) return;

  const values = files.map((f) => ({
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
}

/**
 * Core BFS crawl. Stops after collecting `maxFiles` files.
 * If `onBatch` is provided, calls it with each page of discovered files
 * as they are found (for incremental DB writes).
 */
async function crawlFiles(
  portcoId: string,
  maxFiles: number,
  onBatch?: (files: GDriveFileWithPath[]) => Promise<void>,
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

      const pageFiles: GDriveFileWithPath[] = [];

      for (const file of res.data.files ?? []) {
        if (!file.id || !file.name) continue;

        if (file.mimeType === FOLDER_MIME) {
          const subPath = currentPath
            ? `${currentPath}/${file.name}`
            : file.name;
          queue.push([file.id, subPath, depth + 1]);
        } else {
          const gdriveFile: GDriveFileWithPath = {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType ?? "",
            size: file.size ?? null,
            modifiedTime: file.modifiedTime ?? null,
            webViewLink: file.webViewLink ?? null,
            parentPath: currentPath,
          };

          allFiles.push(gdriveFile);
          pageFiles.push(gdriveFile);

          if (allFiles.length >= maxFiles) break;
        }
      }

      // Flush this page to DB immediately if callback provided
      if (onBatch && pageFiles.length > 0) {
        await onBatch(pageFiles);
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && allFiles.length < maxFiles);
  }

  const complete = queue.length === 0 && allFiles.length < maxFiles;
  return { files: allFiles, complete };
}

/**
 * Full recursive crawl of GDrive. Used by callers that need the file list
 * without writing to the DB (e.g., im-processor's scanAndProcessFolder).
 */
export async function listFilesRecursive(
  portcoId: string,
): Promise<GDriveFileWithPath[]> {
  const { files } = await crawlFiles(portcoId, MAX_FILES);
  return files;
}

/**
 * Crawl GDrive and incrementally upsert discovered files into gdrive_file_cache.
 * Each page of results (~200 files) is written to the DB as soon as it's received,
 * so partial results survive even if the crawl fails partway through.
 * After the crawl completes, stale rows (not seen in this scan) are removed.
 */
export async function crawlAndSyncFiles(
  portcoId: string,
): Promise<{ files: GDriveFileWithPath[]; upserted: number; removed: number }> {
  const scanStart = new Date();
  let upserted = 0;

  const { files } = await crawlFiles(portcoId, MAX_FILES, async (batch) => {
    await upsertBatch(portcoId, batch, scanStart);
    upserted += batch.length;
  });

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

  return { files, upserted, removed };
}
