import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoverySessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateInterviewSession } from "@/lib/auth/interview-jwt";

const VALID_TAGS = [
  "felt_natural",
  "too_many_questions",
  "confusing",
  "helpful",
  "too_slow",
  "too_fast",
] as const;

export async function POST(req: NextRequest) {
  const sessionId = await validateInterviewSession(req);
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { rating, tags, comment } = body as {
    rating?: number;
    tags?: string[];
    comment?: string;
  };

  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }

  const validTags = (tags ?? []).filter((t: string) =>
    (VALID_TAGS as readonly string[]).includes(t)
  );

  // Verify session exists and hasn't already been rated
  const [session] = await db
    .select({ feedbackRating: discoverySessions.feedbackRating })
    .from(discoverySessions)
    .where(eq(discoverySessions.id, sessionId))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.feedbackRating) {
    return NextResponse.json({ error: "Feedback already submitted" }, { status: 409 });
  }

  await db
    .update(discoverySessions)
    .set({
      feedbackRating: rating,
      feedbackTags: validTags.length > 0 ? validTags : null,
      feedbackComment: comment?.trim() || null,
      feedbackAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(discoverySessions.id, sessionId));

  return NextResponse.json({ success: true });
}
