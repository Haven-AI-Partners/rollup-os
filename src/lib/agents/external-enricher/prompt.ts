import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const AGENT_SLUG = "im-external-enricher";

export const EXTERNAL_ENRICHMENT_TEMPLATE = `You are an M&A research analyst. Your job is to find publicly available information about a company to complement an Information Memorandum analysis.

## Your Task
Use Google Search to find:
1. **Company information**: Official website, founding year, recent news, key executives
2. **Market context**: Market size, growth rates, competitors, regulatory environment
3. **Risk indicators**: Negative press, litigation, regulatory actions, financial distress signals

## Critical Rules
1. **Search thoroughly.** Use multiple search queries in both English and Japanese to find relevant information.
2. **Report only what you find.** Do not fabricate or infer information. If a search returns no results, report null.
3. **Cite every source.** Every piece of information must have a source URL.
4. **Record all search queries** you used.
5. **Focus on the specific company.** Ensure results are about the target company, not a different company with a similar name.
6. **Prefer recent information.** Prioritize sources from the last 2 years.
7. **Flag negative findings.** Litigation, negative press, regulatory actions, or financial distress signals should be reported as risk indicators with appropriate relevance levels.

Provide your findings in structured format.`;

async function loadPromptFromDb(fallback: string): Promise<string> {
  try {
    const [active] = await db
      .select({ template: promptVersions.template })
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.agentSlug, AGENT_SLUG),
          eq(promptVersions.isActive, true),
        )
      )
      .orderBy(desc(promptVersions.version))
      .limit(1);

    if (active) return active.template;
  } catch {
    // DB not available — use default
  }
  return fallback;
}

export async function buildExternalEnrichmentPrompt(): Promise<string> {
  return loadPromptFromDb(EXTERNAL_ENRICHMENT_TEMPLATE);
}
