import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gdrive/client";

export async function GET(req: NextRequest) {
  const portcoSlug = req.nextUrl.searchParams.get("portcoSlug");
  if (!portcoSlug) {
    return NextResponse.json({ error: "Missing portcoSlug" }, { status: 400 });
  }

  const url = getAuthUrl(portcoSlug);
  return NextResponse.json({ url });
}
