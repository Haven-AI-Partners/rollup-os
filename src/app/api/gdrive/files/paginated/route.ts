import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuth, getUserPortcoRole } from "@/lib/auth";
import { listFilesPage, listFilesRecursive, isFileCacheFresh } from "@/lib/gdrive/scanner";
import { db } from "@/lib/db";
import { files as filesTable, portcos } from "@/lib/db/schema";
import { inArray, eq } from "drizzle-orm";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const portcoId = req.nextUrl.searchParams.get("portcoId");
  if (!portcoId) {
    return NextResponse.json({ error: "Missing portcoId" }, { status: 400 });
  }

  const cursor = parseInt(req.nextUrl.searchParams.get("cursor") ?? "0", 10);
  const limit = Math.min(
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

    // Fetch only the files needed for this page (fast on cache miss)
    const { files: pageFiles, total, hasMore } = await listFilesPage(portcoId, cursor, limit);

    // Warm the full cache in the background if not already cached
    if (!isFileCacheFresh(portcoId)) {
      after(async () => {
        await listFilesRecursive(portcoId);
      });
    }

    // Cross-reference with DB for processing status
    const gdriveIds = pageFiles.map((f) => f.id).filter(Boolean);
    const processedFiles =
      gdriveIds.length > 0
        ? await db
            .select({
              gdriveFileId: filesTable.gdriveFileId,
              processingStatus: filesTable.processingStatus,
              dealId: filesTable.dealId,
            })
            .from(filesTable)
            .where(inArray(filesTable.gdriveFileId, gdriveIds))
        : [];

    const processedMap = Object.fromEntries(
      processedFiles.map((f) => [
        f.gdriveFileId,
        { status: f.processingStatus, dealId: f.dealId },
      ]),
    );

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
