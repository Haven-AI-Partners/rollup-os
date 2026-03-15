import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { discoverySessions, discoveryCampaigns, companyEmployees, deals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runInterviewStream, saveMessage, loadMessages } from "@/lib/agents/discovery-interviewer";
import { validateInterviewSession } from "@/lib/auth/interview-jwt";

/** Extract text content from a v6 UIMessage (parts-based) or legacy message (content-based) */
function extractText(message: Record<string, unknown>): string {
  if (Array.isArray(message.parts)) {
    return (message.parts as Array<{ type: string; text?: string }>)
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join("");
  }
  if (typeof message.content === "string") {
    return message.content;
  }
  return "";
}

export async function POST(req: NextRequest) {
  const sessionId = await validateInterviewSession(req);
  if (!sessionId) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const clientMessages = body.messages as Array<Record<string, unknown>> | undefined;

  const lastUserMessage = clientMessages
    ?.slice()
    .reverse()
    .find((m) => m.role === "user");

  const userText = lastUserMessage ? extractText(lastUserMessage) : null;

  if (!userText) {
    return new Response("No user message", { status: 400 });
  }

  // Load session context
  const [session] = await db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.id, sessionId))
    .limit(1);

  if (!session || session.status === "completed") {
    return new Response("Session not available", { status: 400 });
  }

  // Load campaign, employee, and deal info in parallel
  const [[campaign], [employee]] = await Promise.all([
    db.select().from(discoveryCampaigns).where(eq(discoveryCampaigns.id, session.campaignId)).limit(1),
    db.select().from(companyEmployees).where(eq(companyEmployees.id, session.employeeId)).limit(1),
  ]);

  if (!campaign || !employee) {
    return new Response("Campaign or employee not found", { status: 404 });
  }

  // Save user message and load history + deal info in parallel
  const [, dbMessages, [deal]] = await Promise.all([
    saveMessage(sessionId, "user", userText),
    loadMessages(sessionId),
    db.select({ companyName: deals.companyName }).from(deals).where(eq(deals.id, campaign.dealId)).limit(1),
  ]);

  // Build messages for model — include the just-saved user message
  // (loadMessages ran concurrently with save, so it may not include it)
  const historyMessages = dbMessages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Ensure the latest user message is included
  const lastHistoryMsg = historyMessages[historyMessages.length - 1];
  if (!lastHistoryMsg || lastHistoryMsg.content !== userText || lastHistoryMsg.role !== "user") {
    historyMessages.push({ role: "user", content: userText });
  }

  // Update last active
  await db
    .update(discoverySessions)
    .set({ lastActiveAt: new Date(), updatedAt: new Date() })
    .where(eq(discoverySessions.id, sessionId));

  const promptConfig = campaign.promptConfig as { agentName?: string; description?: string } | null;

  const result = await runInterviewStream(
    {
      sessionId,
      campaignId: campaign.id,
      employeeId: employee.id,
      employeeName: employee.name,
      companyName: deal?.companyName ?? "会社",
      campaignDescription: promptConfig?.description ?? campaign.description ?? undefined,
      agentName: promptConfig?.agentName ?? "太郎",
    },
    historyMessages,
  );

  const response = result.toTextStreamResponse();

  // Save assistant message after stream completes (in background)
  void (async () => {
    try {
      const text = await result.text;
      if (text) {
        await saveMessage(sessionId, "assistant", text);
      }
    } catch (e) {
      console.error("Failed to save assistant message:", e);
    }
  })();

  return response;
}
