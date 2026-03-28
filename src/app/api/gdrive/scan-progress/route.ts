import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserPortcoRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { portcos, gdriveFileCache, gdriveScanFolders } from "@/lib/db/schema";
import { eq, and, gte, count } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const portcoId = req.nextUrl.searchParams.get("portcoId");
  if (!portcoId) {
    return NextResponse.json({ error: "Missing portcoId" }, { status: 400 });
  }

  try {
    const user = await requireAuth();
    const role = await getUserPortcoRole(user.id, portcoId);
    if (!role) {
      return NextResponse.json(
        { error: "Not a member of this PortCo" },
        { status: 403 },
      );
    }

    // Get portco scan metadata
    const [portco] = await db
      .select({
        gdriveScanGeneration: portcos.gdriveScanGeneration,
        gdriveLastCompleteScanAt: portcos.gdriveLastCompleteScanAt,
      })
      .from(portcos)
      .where(eq(portcos.id, portcoId))
      .limit(1);

    if (!portco) {
      return NextResponse.json({ error: "PortCo not found" }, { status: 404 });
    }

    const currentGen = portco.gdriveScanGeneration;

    // Run 3 lightweight COUNT queries in parallel
    const [totalFoldersResult, scannedFoldersResult, cachedFilesResult] =
      await Promise.all([
        db
          .select({ cnt: count() })
          .from(gdriveScanFolders)
          .where(eq(gdriveScanFolders.portcoId, portcoId)),
        db
          .select({ cnt: count() })
          .from(gdriveScanFolders)
          .where(
            and(
              eq(gdriveScanFolders.portcoId, portcoId),
              gte(gdriveScanFolders.scanGeneration, currentGen),
            ),
          ),
        db
          .select({ cnt: count() })
          .from(gdriveFileCache)
          .where(eq(gdriveFileCache.portcoId, portcoId)),
      ]);

    const totalFolders = totalFoldersResult[0]?.cnt ?? 0;
    const scannedFolders = scannedFoldersResult[0]?.cnt ?? 0;
    const cachedFiles = cachedFilesResult[0]?.cnt ?? 0;
    const scanInProgress = totalFolders > 0 && scannedFolders < totalFolders;

    return NextResponse.json({
      totalFolders,
      scannedFolders,
      cachedFiles,
      scanInProgress,
      lastCompleteScanAt:
        portco.gdriveLastCompleteScanAt?.toISOString() ?? null,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Scan progress API error:", err);
    return NextResponse.json(
      { error: "Failed to get scan progress" },
      { status: 500 },
    );
  }
}
