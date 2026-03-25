import { streamText, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { companyProfiles, dealThesisNodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { getDeal } from "@/lib/db/cached-queries";
import type { IMAnalysisResult } from "@/lib/agents/im-processor/schema";

const MODEL_ID = "gemini-2.5-flash";

async function buildDealContext(dealId: string): Promise<string> {
  const [deal, profile, thesisNodes] = await Promise.all([
    getDeal(dealId),
    db
      .select({ rawExtraction: companyProfiles.rawExtraction })
      .from(companyProfiles)
      .where(eq(companyProfiles.dealId, dealId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        label: dealThesisNodes.label,
        status: dealThesisNodes.status,
        value: dealThesisNodes.value,
        notes: dealThesisNodes.notes,
        templateNodeId: dealThesisNodes.templateNodeId,
      })
      .from(dealThesisNodes)
      .where(eq(dealThesisNodes.dealId, dealId)),
  ]);

  if (!deal) return "No deal data available.";

  const parts: string[] = [];

  // Basic deal info
  parts.push(`## Deal Overview
- Company: ${deal.companyName}
- Industry: ${deal.industry ?? "Unknown"}
- Location: ${deal.location ?? "Unknown"}
- Revenue: ${deal.revenue ?? "Unknown"}
- EBITDA: ${deal.ebitda ?? "Unknown"}
- Asking Price: ${deal.askingPrice ?? "Unknown"}
- Employee Count: ${deal.employeeCount ?? "Unknown"}
- Description: ${deal.description ?? "N/A"}`);

  // IM extraction data
  const extraction = profile?.rawExtraction as IMAnalysisResult | null;
  if (extraction) {
    const cp = extraction.companyProfile;
    parts.push(`## Company Profile (from IM)
- Summary: ${cp.summary}
- Business Model: ${cp.businessModel ?? "Unknown"}
- Market Position: ${cp.marketPosition ?? "Unknown"}
- Strengths: ${cp.strengths?.join(", ") ?? "N/A"}
- Key Risks: ${cp.keyRisks?.join(", ") ?? "N/A"}
- Industry Trends: ${cp.industryTrends ?? "N/A"}`);

    const fin = extraction.financialHighlights;
    parts.push(`## Financial Highlights (from IM)
- Revenue: ${fin.revenue ?? "Unknown"} (${fin.currency ?? "JPY"})
- EBITDA: ${fin.ebitda ?? "Unknown"}
- EBITDA Margin: ${fin.ebitdaMargin ?? "Unknown"}
- Revenue Growth: ${fin.revenueGrowth ?? "Unknown"}
- Recurring Revenue: ${fin.recurringRevenue ?? "Unknown"}
- Top Client Concentration: ${fin.topClientConcentration ?? "Unknown"}`);

    if (extraction.managementTeam?.length) {
      parts.push(`## Management Team
${extraction.managementTeam.map((m) => `- ${m.name}: ${m.title}`).join("\n")}`);
    }
  }

  // Thesis tree status
  if (thesisNodes.length > 0) {
    const statusSummary = thesisNodes.reduce(
      (acc, n) => {
        acc[n.status] = (acc[n.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    parts.push(`## DD Thesis Tree Status
- Total nodes: ${thesisNodes.length}
- Complete: ${statusSummary["complete"] ?? 0}
- Partial: ${statusSummary["partial"] ?? 0}
- Unknown: ${statusSummary["unknown"] ?? 0}
- Risk: ${statusSummary["risk"] ?? 0}`);

    // Include nodes with values or notes
    const filledNodes = thesisNodes.filter((n) => n.value || n.notes);
    if (filledNodes.length > 0) {
      parts.push(`## DD Findings
${filledNodes
  .map(
    (n) =>
      `### ${n.label} [${n.status}]${n.value ? `\nValue: ${n.value}` : ""}${n.notes ? `\nNotes: ${n.notes}` : ""}`,
  )
  .join("\n\n")}`);
    }
  }

  return parts.join("\n\n");
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, dealId } = await req.json();

  if (!dealId) {
    return new Response("Missing dealId", { status: 400 });
  }

  const dealContext = await buildDealContext(dealId);

  const result = streamText({
    model: google(MODEL_ID),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    stopWhen: ({ steps }) => steps.length >= 5,
    system: `You are a Due Diligence Research Assistant for M&A transactions. You help analysts evaluate acquisition targets by answering questions, researching market data, and identifying risks.

You have access to Google Search to look up real-time market data, competitor information, regulatory requirements, and industry trends.

## Current Deal Context
${dealContext}

## Guidelines
- Be concise and data-driven in your responses.
- When you have data from the IM or thesis tree, reference it explicitly.
- When asked about market data, competitors, or external information, use Google Search to find current data.
- Flag any risks or concerns you notice.
- If information is missing from the DD thesis tree, suggest what should be investigated.
- Format responses with clear headers and bullet points for readability.
- When citing web sources, include the source name.`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
