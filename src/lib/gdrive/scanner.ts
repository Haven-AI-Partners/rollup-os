import { getDriveClient } from "./client";

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
const MAX_FILES = 2000;
const FOLDER_MIME = "application/vnd.google-apps.folder";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  files: GDriveFileWithPath[];
  complete: boolean;
  timestamp: number;
}

const fileCache = new Map<string, CacheEntry>();

/** Evict the cache for a portco (call after scan/reprocess) */
export function invalidateFilesCache(portcoId: string) {
  fileCache.delete(portcoId);
}

/** Check if a full crawl is already cached and fresh */
export function isFileCacheFresh(portcoId: string): boolean {
  const cached = fileCache.get(portcoId);
  return Boolean(cached?.complete && Date.now() - cached.timestamp < CACHE_TTL_MS);
}

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
 * Get a page of files. Returns from cache if available,
 * otherwise does a minimal BFS crawl (just enough for this page).
 */
export async function listFilesPage(
  portcoId: string,
  cursor: number,
  limit: number,
): Promise<{ files: GDriveFileWithPath[]; total: number | null; hasMore: boolean }> {
  const cached = fileCache.get(portcoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    // Only use cache if it has enough files for this page, or crawl is complete
    if (cached.complete || cursor + limit <= cached.files.length) {
      const slice = cached.files.slice(cursor, cursor + limit);
      return {
        files: slice,
        total: cached.complete ? cached.files.length : null,
        hasMore: cached.complete
          ? cursor + limit < cached.files.length
          : true,
      };
    }
    // Cache is incomplete and doesn't have enough files — fall through to crawl more
  }

  // No usable cache — crawl just enough for this page
  const needed = cursor + limit;
  const { files, complete } = await crawlFiles(portcoId, needed);

  // Update cache — but don't overwrite a more complete cache from the background crawl
  const existing = fileCache.get(portcoId);
  if (!existing || files.length >= existing.files.length) {
    fileCache.set(portcoId, { files, complete, timestamp: Date.now() });
  }

  const slice = files.slice(cursor, cursor + limit);
  return {
    files: slice,
    total: complete ? files.length : null,
    hasMore: !complete || cursor + limit < files.length,
  };
}

/**
 * Full recursive crawl. Used for background cache warming and
 * by other callers (scan folder, reprocess, etc.).
 * Results are cached in-memory for CACHE_TTL_MS.
 */
export async function listFilesRecursive(
  portcoId: string,
): Promise<GDriveFileWithPath[]> {
  const cached = fileCache.get(portcoId);
  if (cached?.complete && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.files;
  }

  const { files, complete } = await crawlFiles(portcoId, MAX_FILES);
  fileCache.set(portcoId, { files, complete, timestamp: Date.now() });
  return files;
}
