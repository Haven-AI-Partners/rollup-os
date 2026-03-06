import { SCORING_DIMENSIONS, JP_MARKET_NORMS } from "@/lib/scoring/rubric";
import { RED_FLAG_DEFINITIONS } from "@/lib/scoring/red-flags";

/**
 * Build the system prompt for IM analysis.
 * Includes full scoring rubric and red flag definitions.
 */
export function buildSystemPrompt(): string {
  const dimensionPrompt = SCORING_DIMENSIONS.map((dim) => {
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

  const redFlagPrompt = RED_FLAG_DEFINITIONS.map(
    (f) => `- ${f.id} [${f.severity}/${f.category}]: ${f.title} — ${f.description}`
  ).join("\n");

  return `You are an expert M&A analyst specializing in Japanese IT services companies. You are analyzing an Information Memorandum (IM) document for a potential acquisition target.

Your task is to:
1. Extract key company information and create a structured profile
2. Score the company across 8 dimensions using the rubric below
3. Identify any red flags from the predefined list
4. Note any information gaps (important data missing from the IM)

## Important Guidelines
- Be conservative in scoring. Only give a 5 if clearly excellent. Default to 3 (Acceptable) when evidence is ambiguous.
- Only flag red flags where there is clear evidence in the IM. Do not speculate.
- For info gaps, flag important missing information that would be needed for due diligence.
- Many IMs are in Japanese. Analyze the content regardless of language.
- All monetary amounts should be noted in the original currency (usually JPY).
- Use the exact flag IDs from the predefined list below.

## Japan IT Services Market Context
- Typical bill rates: ${JP_MARKET_NORMS.billRates}
- Operating margins: ${JP_MARKET_NORMS.operatingMargins}
- Employee utilization: ${JP_MARKET_NORMS.employeeUtilization}
- Payment terms: ${JP_MARKET_NORMS.clientPaymentTerms}

## Scoring Rubric (8 Dimensions)

${dimensionPrompt}

## Red Flag Definitions (use exact IDs)

${redFlagPrompt}

Analyze the IM document text provided and return a structured analysis.`;
}
