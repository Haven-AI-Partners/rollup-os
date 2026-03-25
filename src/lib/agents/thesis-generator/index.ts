import { generateObject, generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { companyProfiles, deals, portcos, dealThesisNodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { thesisGenerationSchema, type ThesisGenerationResult } from "./schema";
import { buildThesisGenerationPrompt } from "./prompt";
import type { IMAnalysisResult } from "@/lib/agents/im-processor/schema";

export const MODEL_ID = "gemini-2.5-flash";

interface GenerateThesisInput {
  dealId: string;
  portcoId: string;
}

/**
 * Run a web search to gather market research context for the target company.
 */
async function gatherMarketResearch(
  companyName: string,
  industry: string | null,
): Promise<string> {
  try {
    const { text } = await generateText({
      model: google(MODEL_ID),
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      system: `You are a market research analyst. Search the web for relevant information about the target company and its industry. Focus on:
1. Market size and growth trends
2. Competitive landscape and key players
3. Industry-specific regulatory requirements
4. Recent M&A activity in the sector
5. Technology trends affecting the industry

Compile your findings into a concise research summary. If you cannot find specific information, note what is unavailable.`,
      messages: [
        {
          role: "user",
          content: `Research the following company and its industry for M&A due diligence:
- Company: ${companyName}
- Industry: ${industry ?? "Unknown"}

Search for market data, competitors, regulatory landscape, and recent industry trends.`,
        },
      ],
      stopWhen: stepCountIs(5),
    });
    return text;
  } catch (e) {
    console.error("Market research web search failed:", e);
    return "Web search unavailable — generating nodes from IM data only.";
  }
}

/**
 * Generate industry-specific thesis nodes using AI.
 * First gathers market research via web search, then generates
 * relevant diligence branches that extend the base template.
 */
export async function generateIndustryNodes(
  input: GenerateThesisInput,
): Promise<ThesisGenerationResult> {
  const [deal, profile, portco] = await Promise.all([
    db.select().from(deals).where(eq(deals.id, input.dealId)).limit(1).then((r) => r[0]),
    db
      .select({ rawExtraction: companyProfiles.rawExtraction })
      .from(companyProfiles)
      .where(eq(companyProfiles.dealId, input.dealId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        investmentThesis: portcos.investmentThesis,
        acquisitionCriteria: portcos.acquisitionCriteria,
      })
      .from(portcos)
      .where(eq(portcos.id, input.portcoId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (!deal) throw new Error("Deal not found");

  const extraction = profile?.rawExtraction as IMAnalysisResult | null;

  // Run web search and prompt building in parallel
  const [marketResearch, prompt] = await Promise.all([
    gatherMarketResearch(deal.companyName, deal.industry),
    buildThesisGenerationPrompt({
      companyName: deal.companyName,
      industry: deal.industry,
      businessModel: extraction?.companyProfile.businessModel ?? null,
      marketPosition: extraction?.companyProfile.marketPosition ?? null,
      investmentThesis: portco?.investmentThesis ?? null,
      strengths: extraction?.companyProfile.strengths ?? [],
      keyRisks: extraction?.companyProfile.keyRisks ?? [],
      rawObservations: (extraction as IMAnalysisResult & { rawObservations?: Record<string, string> })?.rawObservations ?? null,
    }),
  ]);

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: thesisGenerationSchema,
    system: prompt,
    messages: [
      {
        role: "user",
        content: `Generate industry-specific diligence nodes for this acquisition target.

## Web Research Findings
The following market research was gathered via web search. Use it to inform your node generation, especially for market size, competitive landscape, and regulatory requirements:

${marketResearch}`,
      },
    ],
  });

  return object;
}

/**
 * Insert AI-generated nodes into the thesis tree.
 * Matches parentTemplateNodeId to existing nodes and inserts children.
 */
export async function insertGeneratedNodes(
  dealId: string,
  portcoId: string,
  result: ThesisGenerationResult,
): Promise<number> {
  // Load existing nodes to map template IDs to DB IDs
  const existingNodes = await db
    .select({
      id: dealThesisNodes.id,
      templateNodeId: dealThesisNodes.templateNodeId,
    })
    .from(dealThesisNodes)
    .where(eq(dealThesisNodes.dealId, dealId));

  const templateIdToDbId = new Map(
    existingNodes
      .filter((n) => n.templateNodeId)
      .map((n) => [n.templateNodeId!, n.id]),
  );

  const inserts = result.nodes
    .filter((node) => templateIdToDbId.has(node.parentTemplateNodeId))
    .map((node) => ({
      dealId,
      portcoId,
      parentId: templateIdToDbId.get(node.parentTemplateNodeId)!,
      label: node.label,
      description: node.description,
      status: node.suggestedStatus,
      value: node.suggestedValue,
      notes: node.suggestedNotes,
      source: "agent_generated" as const,
      sortOrder: node.sortOrder,
    }));

  if (inserts.length > 0) {
    await db.insert(dealThesisNodes).values(inserts);
  }

  return inserts.length;
}
