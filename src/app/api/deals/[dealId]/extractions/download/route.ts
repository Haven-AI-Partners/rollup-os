import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deals, files, fileExtractions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getUserPortcoRole } from "@/lib/auth";
import {
  extractionToDownloadable,
  type ContentExtraction,
  type Translation,
} from "@/lib/extraction-download";
import JSZip from "jszip";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const user = await requireAuth();

  // Resolve deal and verify membership
  const [deal] = await db
    .select({ portcoId: deals.portcoId, companyName: deals.companyName })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const role = await getUserPortcoRole(user.id, deal.portcoId);
  if (!role) {
    return NextResponse.json(
      { error: "Not a member of this PortCo" },
      { status: 403 },
    );
  }

  // Fetch all files with extractions for this deal
  const rows = await db
    .select({
      fileName: files.fileName,
      contentExtraction: fileExtractions.contentExtraction,
      translation: fileExtractions.translation,
    })
    .from(files)
    .innerJoin(fileExtractions, eq(fileExtractions.fileId, files.id))
    .where(eq(files.dealId, dealId));

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No extractions found for this deal" },
      { status: 404 },
    );
  }

  // Build zip
  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const row of rows) {
    const { filename, content } = extractionToDownloadable(
      row.fileName,
      row.contentExtraction as ContentExtraction,
      row.translation as Translation | null,
    );

    // Handle filename collisions
    const count = usedNames.get(filename) ?? 0;
    usedNames.set(filename, count + 1);
    const uniqueName =
      count > 0
        ? filename.replace(/\.(\w+)$/, `-${count + 1}.$1`)
        : filename;

    zip.file(uniqueName, content);
  }

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
  const safeName = (deal.companyName ?? "deal").replace(/[^a-zA-Z0-9-_ ]/g, "");

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}-extractions.zip"`,
    },
  });
}
