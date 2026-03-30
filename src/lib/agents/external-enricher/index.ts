import { generateObject, generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { externalEnrichmentResultSchema, type ExternalEnrichmentResult } from "./schema";
import { buildExternalEnrichmentPrompt } from "./prompt";

/**
 * External Enricher Agent
 *
 * A reusable agent that takes basic company information and searches the web
 * for complementary data: company info, market context, and risk indicators.
 *
 * All results are tagged with external source URLs and retrieval timestamps.
 * This agent is generic — it can be used by any pipeline that needs external
 * data about a company (IM processing, DD processing, deal chat, etc.).
 */
export const MODEL_ID = "gemini-2.5-flash";

/** Maximum search steps to prevent excessive API usage */
const MAX_SEARCH_STEPS = 5;

/** Generic input for external enrichment — any pipeline can construct this */
export interface EnrichmentInput {
  companyName: string;
  industry: string | null;
  location: string | null;
}

/**
 * Search the web for information about the company, then structure the results.
 *
 * Two-step process:
 * 1. Use generateText with Google Search tool to gather raw research
 * 2. Use generateObject to structure the research into our schema
 */
export async function enrichExternally(
  input: EnrichmentInput,
): Promise<ExternalEnrichmentResult> {
  try {
    const rawResearch = await gatherResearch(input);

    const { object } = await generateObject({
      model: google(MODEL_ID),
      schema: externalEnrichmentResultSchema,
      system: "Structure the following web research results into the required format. Include all source URLs and set retrievedAt to the current timestamp. Do not add information that is not in the research.",
      messages: [
        {
          role: "user",
          content: `Current timestamp: ${new Date().toISOString()}\n\nResearch about "${input.companyName}":\n\n${rawResearch}`,
        },
      ],
      temperature: 0,
      seed: 42,
    });

    return object;
  } catch (error) {
    console.error("External enrichment failed:", error);
    return emptyEnrichmentResult();
  }
}

/** Use Google Search to gather raw research about the company */
async function gatherResearch(input: EnrichmentInput): Promise<string> {
  const { companyName, industry, location } = input;

  try {
    const { text } = await generateText({
      model: google(MODEL_ID),
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      system: await buildExternalEnrichmentPrompt(),
      messages: [
        {
          role: "user",
          content: `Research the following company for M&A due diligence:
- Company: ${companyName}
- Industry: ${industry ?? "Unknown"}
- Location: ${location ?? "Unknown"}

Search for:
1. Company website and basic info
2. Recent news (last 2 years)
3. Market size and competitors
4. Any litigation, regulatory issues, or negative press
5. Key executives and leadership

Use both English and Japanese search queries.`,
        },
      ],
      stopWhen: stepCountIs(MAX_SEARCH_STEPS),
    });
    return text;
  } catch (error) {
    console.error("Web search failed:", error);
    return "Web search unavailable — no external data could be gathered.";
  }
}

/** Return empty result when enrichment fails gracefully */
export function emptyEnrichmentResult(): ExternalEnrichmentResult {
  return {
    companyInfo: null,
    marketContext: null,
    riskIndicators: [],
    sources: [],
    searchQueries: [],
  };
}
