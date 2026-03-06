import { NextRequest, NextResponse } from "next/server";
import { listFiles } from "@/lib/gdrive/client";

export async function GET(req: NextRequest) {
  const portcoId = req.nextUrl.searchParams.get("portcoId");
  if (!portcoId) {
    return NextResponse.json({ error: "Missing portcoId" }, { status: 400 });
  }

  try {
    const result = await listFiles(portcoId, 100);
    if (!result) {
      return NextResponse.json({ files: [] });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GDrive files API error:", err);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
