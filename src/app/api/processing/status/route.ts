import { NextRequest, NextResponse } from "next/server";
import { runs } from "@trigger.dev/sdk";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await requireAuth();

  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  try {
    const run = await runs.retrieve(runId);
    return NextResponse.json({
      id: run.id,
      status: run.status,
      output: run.output,
      error: run.error,
      finishedAt: run.finishedAt,
    });
  } catch {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
}
