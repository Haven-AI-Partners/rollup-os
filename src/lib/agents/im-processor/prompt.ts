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
- **ALL output must be in English**, even though the IM documents are in Japanese. Translate all extracted information to English.
- Be conservative in scoring. Only give a 5 if clearly excellent. Default to 3 (Acceptable) when evidence is ambiguous.
- Only flag red flags where there is clear evidence in the IM. Do not speculate.
- For info gaps, flag important missing information that would be needed for due diligence.
- All monetary amounts should be returned as plain numbers in the original currency of the IM (usually JPY, but may be EUR, USD, etc.). Set the currency field to the ISO code (e.g. 'JPY', 'EUR'). Do NOT include currency symbols or unit suffixes in numeric fields — just digits.
- Use the exact flag IDs from the predefined list below.
- Keep company names in their original form (do not translate company names).

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
