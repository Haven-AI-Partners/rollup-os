import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoverySessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createInterviewToken } from "@/lib/auth/interview-jwt";

export async function POST(req: NextRequest) {
  const { sessionId, password } = await req.json();

  if (!sessionId || !password) {
    return NextResponse.json({ error: "Missing sessionId or password" }, { status: 400 });
  }

  const [session] = await db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.id, sessionId))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }

  if (session.status === "completed") {
    return NextResponse.json({ error: "このインタビューは既に完了しています" }, { status: 400 });
  }

  const valid = await bcrypt.compare(password, session.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  // Update session status
  if (session.status === "pending") {
    await db
      .update(discoverySessions)
      .set({
        status: "in_progress",
        startedAt: new Date(),
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(discoverySessions.id, sessionId));
  } else {
    await db
      .update(discoverySessions)
      .set({ lastActiveAt: new Date(), updatedAt: new Date() })
      .where(eq(discoverySessions.id, sessionId));
  }

  const token = await createInterviewToken(sessionId);

  const response = NextResponse.json({ success: true });
  response.cookies.set("discovery_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
