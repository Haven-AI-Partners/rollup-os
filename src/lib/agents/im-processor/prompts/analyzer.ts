import { SCORING_DIMENSIONS, JP_MARKET_NORMS } from "@/lib/scoring/rubric";
import { RED_FLAG_DEFINITIONS } from "@/lib/scoring/red-flags";
import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const EXTRACTION_SLUG = "im-processor-extraction";
export const SCORING_SLUG = "im-processor-scoring";

/** Build the dynamic rubric section */
function buildScoringRubric(): string {
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
function buildRedFlagList(): string {
  return RED_FLAG_DEFINITIONS.map(
    (f) => `- ${f.id} [${f.severity}/${f.category}]: ${f.title} — ${f.description}`
  ).join("\n");
}

/** Build the dynamic market context section */
function buildMarketContext(): string {
  return `- Typical bill rates: ${JP_MARKET_NORMS.billRates}
- Operating margins: ${JP_MARKET_NORMS.operatingMargins}
- Employee utilization: ${JP_MARKET_NORMS.employeeUtilization}
- Payment terms: ${JP_MARKET_NORMS.clientPaymentTerms}`;
}

// ── Extraction prompt (sub-pass 1) ──

export const ANALYZER_EXTRACTION_TEMPLATE = `You are an expert M&A analyst specializing in Japanese IT services companies. You are extracting structured information from translated pages of an Information Memorandum (IM).

Your task is ONLY to extract facts and tag each piece of data with its source page. Do NOT score, judge, rate, or evaluate the company. Just report what the IM says.

## CRITICAL: Source Attribution Rules
- For EVERY field you extract, you MUST provide a sourceRef with:
  - pageNumbers: which page(s) the data came from
  - quote: the exact text or a close paraphrase from the IM that supports the value
- You may ONLY use information from the provided document pages. Do NOT use external knowledge, assumptions, or inference.
- If data is not found in the document, set the value to null and set sourceRef.quote to "Not mentioned in the IM" with an empty pageNumbers array.

## What to extract
1. Company profile: name, summary, business model, market position, industry trends, strengths, risks, location, industry, asking price
2. Financial highlights: revenue, EBITDA, margins, growth, employee count (with full-time vs contractor breakdown), client concentration, debt levels
3. Management team: ALL named individuals with titles and reporting relationships
4. Raw observations: for each topic area, extract ALL relevant facts, numbers, and direct quotes from the IM

## Important Guidelines
- All monetary amounts should be plain numbers in the original currency. Set the currency field to the ISO code.
- Keep company names in their original form (do not translate).
- **Management team**: Include ALL named individuals. Infer reporting relationships from context.
- **Raw observations**: Extract ALL relevant facts. If the IM contains no info for a category, state that clearly.

## Japan IT Services Market Context (for reference when extracting)
{{MARKET_CONTEXT}}

Extract all factual information from the document pages provided.`;

// ── Scoring prompt (sub-pass 2) ──

export const ANALYZER_SCORING_TEMPLATE = `You are an expert M&A analyst specializing in Japanese IT services companies. You are scoring a company based on structured data extracted from its Information Memorandum (IM).

You will receive a JSON object containing the company's profile, financial highlights, management team, and raw observations extracted from the IM. Score the company based ONLY on this data. Do not infer information beyond what is provided.

## Your task
1. Score the company across 8 dimensions using the rubric below
2. Identify any red flags from the predefined list
3. Note any information gaps (important data missing from the extraction)

## Scoring Consistency Rules (CRITICAL — follow these exactly)

### Evidence-based scoring
For EVERY dimension score, your rationale MUST reference specific data from the extraction:
- If a numeric threshold exists (e.g. "CAGR >15%"), check if the extraction provides the actual number. If yes, apply the threshold mechanically. If no, state "Not disclosed" in the rationale.
- Never infer numbers that are not stated.

### Default scores when data is missing
When the extraction does NOT provide enough information to evaluate a dimension:
- **Financial Stability**: Default to 3. Flag gap_fin_no_audit or gap_fin_no_cashflow as appropriate.
- **Debt & Financial Leverage**: Default to 3. Most Japanese SMEs carry minimal debt — assume acceptable unless stated otherwise.
- **Organizational Complexity**: Default to 4. Single-entity companies are the norm for Japanese IT SMEs.
- **Technology & Technical Capability**: Default to 3. Flag gap_tech_no_stack.
- **Client Concentration**: Default to 3. Flag gap_cli_no_list.
- **AI & Digital Transformation Readiness**: Default to 2. Assume no AI initiatives unless explicitly mentioned.
- **Business Model & Service Mix**: Default to 3 for mixed/project-based. Only score higher/lower with explicit evidence.
- **Post-Merger Integration Risk**: Default to 3. This dimension is inherently speculative — only deviate with strong evidence.

### Red flag rules
- **Do NOT flag based on absence of information.** Missing data is an info_gap, not a red flag.
- **Info gaps ARE expected.** Flag all important missing information using info_gap IDs.
- **When in doubt, do NOT flag.** Only flag red flags you are >90% confident about based on explicit evidence.
- **Limit red flags to a maximum of 5** (excluding info_gaps).

## Japan IT Services Market Context
{{MARKET_CONTEXT}}

## Scoring Rubric (8 Dimensions)

{{SCORING_RUBRIC}}

## Red Flag Definitions (use exact IDs)

{{RED_FLAGS}}

Score the company based on the extraction data provided. Ground every score and flag in specific evidence from the extraction.`;

/** Render a template by substituting placeholders with dynamic content */
export function renderTemplate(template: string): string {
  return template
    .replace("{{SCORING_RUBRIC}}", buildScoringRubric())
    .replace("{{RED_FLAGS}}", buildRedFlagList())
    .replace("{{MARKET_CONTEXT}}", buildMarketContext());
}

/** Load a prompt from DB by agent slug, falling back to the provided default */
async function loadPromptFromDb(agentSlug: string, fallback: string): Promise<string> {
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
    // DB not available — use default
  }
  return renderTemplate(fallback);
}

/** Build the extraction prompt (sub-pass 1) */
export async function buildAnalyzerExtractionPrompt(): Promise<string> {
  return loadPromptFromDb(EXTRACTION_SLUG, ANALYZER_EXTRACTION_TEMPLATE);
}

/** Build the scoring prompt (sub-pass 2) */
export async function buildAnalyzerScoringPrompt(): Promise<string> {
  return loadPromptFromDb(SCORING_SLUG, ANALYZER_SCORING_TEMPLATE);
}
