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
  timestamp: number;
}

const fileCache = new Map<string, CacheEntry>();

/** Evict the cache for a portco (call after scan/reprocess) */
export function invalidateFilesCache(portcoId: string) {
  fileCache.delete(portcoId);
}

/**
 * Recursively list all files from a GDrive folder tree.
 * Results are cached in-memory for CACHE_TTL_MS to avoid
 * re-crawling GDrive on every paginated request.
 */
export async function listFilesRecursive(
  portcoId: string,
): Promise<GDriveFileWithPath[]> {
  const cached = fileCache.get(portcoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.files;
  }

  const result = await getDriveClient(portcoId);
  if (!result) return [];

  const { drive, folderId } = result;
  if (!folderId) return [];

  const allFiles: GDriveFileWithPath[] = [];

  // BFS queue: [folderId, path, depth]
  const queue: Array<[string, string, number]> = [[folderId, "", 0]];

  while (queue.length > 0 && allFiles.length < MAX_FILES) {
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
          // Queue subfolder for crawling
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

          if (allFiles.length >= MAX_FILES) break;
        }
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && allFiles.length < MAX_FILES);
  }

  fileCache.set(portcoId, { files: allFiles, timestamp: Date.now() });

  return allFiles;
}
