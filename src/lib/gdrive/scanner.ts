import { getDriveClient } from "./client";
import { withRateLimit } from "./rate-limit";
import { db } from "@/lib/db";
import { gdriveFileCache, gdriveScanFolders, portcos } from "@/lib/db/schema";
import { eq, sql, and, lt, asc, count } from "drizzle-orm";

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
      const res = await withRateLimit(
        () => drive.files.list({
          q: `'${currentFolderId}' in parents and trashed = false`,
          pageSize: 200,
          pageToken,
          fields:
            "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
          orderBy: "modifiedTime desc",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        }),
        `crawlFiles folder=${currentFolderId}`,
      );

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

export interface IncrementalScanResult {
  foldersScanned: number;
  foldersErrored: number;
  filesUpserted: number;
  scanComplete: boolean;
}

/** Upsert a folder row into gdrive_scan_folders. */
async function upsertFolder(
  portcoId: string,
  gdriveFolderId: string,
  parentPath: string,
  depth: number,
): Promise<void> {
  await db
    .insert(gdriveScanFolders)
    .values({ portcoId, gdriveFolderId, parentPath, depth })
    .onConflictDoUpdate({
      target: [gdriveScanFolders.portcoId, gdriveScanFolders.gdriveFolderId],
      set: {
        parentPath: sql`EXCLUDED.parent_path`,
        depth: sql`EXCLUDED.depth`,
      },
    });
}

/**
 * Incremental folder-level scanning with time budgeting.
 *
 * Instead of a single monolithic BFS crawl, this function tracks each folder
 * in the `gdrive_scan_folders` table and processes them one at a time.
 * Each run picks up where the last one left off, processing folders oldest-first.
 *
 * A `scanGeneration` counter on the portco row ensures stale file cleanup only
 * happens after every folder has been visited in the current generation.
 *
 * @param portcoId - The portco to scan
 * @param timeBudgetMs - Maximum time to spend scanning (e.g. 480_000 for 8 min)
 */
export async function crawlFoldersIncremental(
  portcoId: string,
  timeBudgetMs: number,
): Promise<IncrementalScanResult> {
  const startTime = Date.now();
  const scanTimestamp = new Date();

  const clientResult = await getDriveClient(portcoId);
  if (!clientResult) return { foldersScanned: 0, foldersErrored: 0, filesUpserted: 0, scanComplete: true };

  const { drive, folderId } = clientResult;
  if (!folderId) return { foldersScanned: 0, foldersErrored: 0, filesUpserted: 0, scanComplete: true };

  // 1. Determine the current scan generation
  const [portcoRow] = await db
    .select({ gdriveScanGeneration: portcos.gdriveScanGeneration })
    .from(portcos)
    .where(eq(portcos.id, portcoId));

  let currentGen = portcoRow?.gdriveScanGeneration ?? 0;

  // Check if previous generation is complete (all folders have current gen)
  const [remaining] = await db
    .select({ cnt: count() })
    .from(gdriveScanFolders)
    .where(
      and(
        eq(gdriveScanFolders.portcoId, portcoId),
        lt(gdriveScanFolders.scanGeneration, currentGen),
      ),
    );

  const previousPassDone = (remaining?.cnt ?? 0) === 0;

  // If all folders are at currentGen (or no folders exist yet), start a new generation
  if (previousPassDone) {
    currentGen += 1;
    await db
      .update(portcos)
      .set({ gdriveScanGeneration: currentGen })
      .where(eq(portcos.id, portcoId));
  }

  // 2. Seed the root folder if not present
  await upsertFolder(portcoId, folderId, "", 0);

  // 3. Query folders needing scanning (scanGeneration < currentGen), oldest first
  const foldersToScan = await db
    .select({
      id: gdriveScanFolders.id,
      gdriveFolderId: gdriveScanFolders.gdriveFolderId,
      parentPath: gdriveScanFolders.parentPath,
      depth: gdriveScanFolders.depth,
    })
    .from(gdriveScanFolders)
    .where(
      and(
        eq(gdriveScanFolders.portcoId, portcoId),
        lt(gdriveScanFolders.scanGeneration, currentGen),
      ),
    )
    .orderBy(asc(gdriveScanFolders.lastScannedAt));

  let foldersScanned = 0;
  let foldersErrored = 0;
  let filesUpserted = 0;

  // 4. Process folders until time budget is exhausted
  for (const folder of foldersToScan) {
    if (Date.now() - startTime >= timeBudgetMs) break;
    if (folder.depth > MAX_DEPTH) {
      // Mark as scanned but skip actual API call
      await db
        .update(gdriveScanFolders)
        .set({ lastScannedAt: scanTimestamp, scanGeneration: currentGen })
        .where(eq(gdriveScanFolders.id, folder.id));
      continue;
    }

    try {
      // List all children of this folder (with pagination)
      let pageToken: string | undefined;
      do {
        const res = await withRateLimit(
          () => drive.files.list({
            q: `'${folder.gdriveFolderId}' in parents and trashed = false`,
            pageSize: 200,
            pageToken,
            fields:
              "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
            orderBy: "modifiedTime desc",
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
          }),
          `crawlFolders folder=${folder.gdriveFolderId}`,
        );

        const pageFiles: GDriveFileWithPath[] = [];

        for (const file of res.data.files ?? []) {
          if (!file.id || !file.name) continue;

          if (file.mimeType === FOLDER_MIME) {
            const subPath = folder.parentPath
              ? `${folder.parentPath}/${file.name}`
              : file.name;
            // Upsert discovered subfolder (new folders get scanGeneration=0, so
            // they'll be picked up in this or a future run)
            await upsertFolder(portcoId, file.id, subPath, folder.depth + 1);
          } else {
            pageFiles.push({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType ?? "",
              size: file.size ?? null,
              modifiedTime: file.modifiedTime ?? null,
              webViewLink: file.webViewLink ?? null,
              parentPath: folder.parentPath,
            });
          }
        }

        // Flush files to cache
        if (pageFiles.length > 0) {
          await upsertBatch(portcoId, pageFiles, scanTimestamp);
          filesUpserted += pageFiles.length;
        }

        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      // Mark this folder as scanned for the current generation
      await db
        .update(gdriveScanFolders)
        .set({ lastScannedAt: scanTimestamp, scanGeneration: currentGen })
        .where(eq(gdriveScanFolders.id, folder.id));

      foldersScanned++;
    } catch (error) {
      foldersErrored++;
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.warn(
        `GDrive folder scan failed for ${folder.gdriveFolderId} (path: ${folder.parentPath}): ${msg} — skipping, will retry next run`,
      );
    }
  }

  // 5. Check if the full pass is now complete
  const [stillRemaining] = await db
    .select({ cnt: count() })
    .from(gdriveScanFolders)
    .where(
      and(
        eq(gdriveScanFolders.portcoId, portcoId),
        lt(gdriveScanFolders.scanGeneration, currentGen),
      ),
    );

  const scanComplete = (stillRemaining?.cnt ?? 0) === 0;

  if (scanComplete) {
    // Full pass done — clean up stale files and folders
    const deleteFilesResult = await db
      .delete(gdriveFileCache)
      .where(
        and(
          eq(gdriveFileCache.portcoId, portcoId),
          lt(gdriveFileCache.lastSeenAt, scanTimestamp),
        ),
      ) as unknown as { rowCount?: number };

    await db
      .delete(gdriveScanFolders)
      .where(
        and(
          eq(gdriveScanFolders.portcoId, portcoId),
          lt(gdriveScanFolders.scanGeneration, currentGen),
        ),
      );

    await db
      .update(portcos)
      .set({ gdriveLastCompleteScanAt: scanTimestamp })
      .where(eq(portcos.id, portcoId));

    const removed = (deleteFilesResult as { rowCount?: number }).rowCount ?? 0;
    if (removed > 0) {
      // Log stale removal count (callers can check scanComplete flag)
    }
  }

  return { foldersScanned, foldersErrored, filesUpserted, scanComplete };
}
