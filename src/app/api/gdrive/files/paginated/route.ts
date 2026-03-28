import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuth, getUserPortcoRole } from "@/lib/auth";
import { crawlAndSyncFiles } from "@/lib/gdrive/scanner";
import { db } from "@/lib/db";
import {
  files as filesTable,
  portcos,
  gdriveFileCache,
} from "@/lib/db/schema";
import { inArray, eq, desc, asc, count, sql } from "drizzle-orm";

const PAGE_SIZE = 50;
const FOLDER_MODE_MAX = 5000;

export async function GET(req: NextRequest) {
  const portcoId = req.nextUrl.searchParams.get("portcoId");
  if (!portcoId) {
    return NextResponse.json({ error: "Missing portcoId" }, { status: 400 });
  }

  const mode = req.nextUrl.searchParams.get("mode");
  const isFolderMode = mode === "folder";
  const cursor = isFolderMode ? 0 : parseInt(req.nextUrl.searchParams.get("cursor") ?? "0", 10);
  const limit = isFolderMode
    ? FOLDER_MODE_MAX
    : Math.min(
        parseInt(req.nextUrl.searchParams.get("limit") ?? String(PAGE_SIZE), 10),
        100,
      );

  try {
    const user = await requireAuth();
    const role = await getUserPortcoRole(user.id, portcoId);
    if (!role) {
      return NextResponse.json({ error: "Not a member of this PortCo" }, { status: 403 });
    }

    // Check if portco has GDrive connected
    const [portco] = await db
      .select({ gdriveServiceAccountEnc: portcos.gdriveServiceAccountEnc })
      .from(portcos)
      .where(eq(portcos.id, portcoId))
      .limit(1);

    if (!portco?.gdriveServiceAccountEnc) {
      return NextResponse.json({ files: [], nextCursor: null, total: 0 });
    }

    // Query cached files from DB (fast ~50ms instead of BFS crawl)
    const [cachedFiles, [totalResult]] = await Promise.all([
      db
        .select()
        .from(gdriveFileCache)
        .where(eq(gdriveFileCache.portcoId, portcoId))
        .orderBy(
          ...(isFolderMode
            ? [asc(gdriveFileCache.parentPath), asc(gdriveFileCache.fileName)]
            : [desc(gdriveFileCache.modifiedTime)]),
        )
        .offset(cursor)
        .limit(limit),
      db
        .select({ count: count() })
        .from(gdriveFileCache)
        .where(eq(gdriveFileCache.portcoId, portcoId)),
    ]);

    const total = totalResult?.count ?? 0;

    // Bootstrap: if cache is empty, trigger background sync
    if (total === 0) {
      after(async () => {
        await crawlAndSyncFiles(portcoId);
      });
      return NextResponse.json({
        files: [],
        processedMap: {},
        nextCursor: null,
        total: 0,
        syncing: true,
      });
    }

    // Map cached rows to the GDriveFile shape the frontend expects
    const pageFiles = cachedFiles.map((row) => ({
      id: row.gdriveFileId,
      name: row.fileName,
      mimeType: row.mimeType,
      size: row.sizeBytes != null ? String(row.sizeBytes) : null,
      modifiedTime: row.modifiedTime?.toISOString() ?? null,
      webViewLink: row.webViewLink,
      parentPath: row.parentPath,
    }));

    // Cross-reference with DB for processing status
    const gdriveIds = pageFiles.map((f) => f.id).filter(Boolean);
    const processedFiles =
      gdriveIds.length > 0
        ? await db
            .select({
              gdriveFileId: filesTable.gdriveFileId,
              processingStatus: filesTable.processingStatus,
              dealId: filesTable.dealId,
              fileType: filesTable.fileType,
              classificationConfidence: filesTable.classificationConfidence,
              classifiedBy: filesTable.classifiedBy,
            })
            .from(filesTable)
            .where(inArray(filesTable.gdriveFileId, gdriveIds))
        : [];

    // Build map preferring "completed" status when duplicates exist
    const processedMap: Record<string, { status: string; dealId: string | null; fileType: string | null; classificationConfidence: string | null; classifiedBy: string | null }> = {};
    for (const f of processedFiles) {
      const key = f.gdriveFileId;
      if (!key) continue;
      const existing = processedMap[key];
      // Keep the completed record if one exists, otherwise take the latest
      if (!existing || f.processingStatus === "completed") {
        processedMap[key] = { status: f.processingStatus, dealId: f.dealId, fileType: f.fileType, classificationConfidence: f.classificationConfidence, classifiedBy: f.classifiedBy };
      }
    }

    const hasMore = cursor + limit < total;
    const nextCursor = hasMore ? cursor + limit : null;

    return NextResponse.json({
      files: pageFiles,
      processedMap,
      nextCursor,
      total,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Paginated GDrive files API error:", err);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
