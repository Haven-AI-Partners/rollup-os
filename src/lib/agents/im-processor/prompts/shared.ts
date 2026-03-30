import { SCORING_DIMENSIONS, JP_MARKET_NORMS } from "@/lib/scoring/rubric";
import { RED_FLAG_DEFINITIONS } from "@/lib/scoring/red-flags";
import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const AGENT_SLUG = "im-processor";
export const EXTRACTION_SLUG = "im-processor-extraction";
export const SCORING_SLUG = "im-processor-scoring";

/** Build the dynamic rubric section */
export function buildScoringRubric(): string {
  return SCORING_DIMENSIONS.map((dim) => {
    const criteriaStr = dim.criteria
      .map((c) => `  Score ${c.score} (${c.label}): ${JSON.stringify(c.criteria)}`)
      .join("\n");
    return `### ${dim.name} (Weight: ${(dim.weight * 100).toFixed(0)}%)
${dim.description}

**What to evaluate:**
${dim.whatToEvaluate.map((w) => `- ${w}`).join("\n")}

**Scoring criteria:**
${criteriaStr}

**Red flags for this dimension:**
${dim.redFlags.map((r) => `- ${r}`).join("\n")}`;
  }).join("\n\n");
}

/** Build the dynamic red flags section */
export function buildRedFlagList(): string {
  return RED_FLAG_DEFINITIONS.map(
    (f) => `- ${f.id} [${f.severity}/${f.category}]: ${f.title} — ${f.description}`
  ).join("\n");
}

/** Build the dynamic market context section */
export function buildMarketContext(): string {
  return `- Typical bill rates: ${JP_MARKET_NORMS.billRates}
- Operating margins: ${JP_MARKET_NORMS.operatingMargins}
- Employee utilization: ${JP_MARKET_NORMS.employeeUtilization}
- Payment terms: ${JP_MARKET_NORMS.clientPaymentTerms}`;
}

/** Render a template by substituting placeholders with dynamic content */
export function renderTemplate(template: string): string {
  return template
    .replace("{{SCORING_RUBRIC}}", buildScoringRubric())
    .replace("{{RED_FLAGS}}", buildRedFlagList())
    .replace("{{MARKET_CONTEXT}}", buildMarketContext());
}

/** Load a prompt from DB by agent slug, falling back to the provided default */
export async function loadPromptFromDb(agentSlug: string, fallback: string): Promise<string> {
  try {
    const [active] = await db
      .select({ template: promptVersions.template })
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.agentSlug, agentSlug),
          eq(promptVersions.isActive, true),
        )
      )
      .orderBy(desc(promptVersions.version))
      .limit(1);

    if (active) {
      return renderTemplate(active.template);
    }
  } catch {
    // DB not available or table doesn't exist yet — use default
  }
  return renderTemplate(fallback);
}
