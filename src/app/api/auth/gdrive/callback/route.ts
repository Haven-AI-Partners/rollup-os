import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/gdrive/client";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state"); // portcoSlug

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  // Validate state is a safe portcoSlug (alphanumeric + hyphens only)
  const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/;
  if (!SLUG_PATTERN.test(state)) {
    return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
  }

  try {
    await handleCallback(code, state);
    return NextResponse.redirect(new URL(`/${state}/settings?gdrive=connected`, req.url));
  } catch (err: unknown) {
    console.error("GDrive OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/${state}/settings?gdrive_error=auth_failed`, req.url)
    );
  }
}
