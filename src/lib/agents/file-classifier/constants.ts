/** Vision model used by Tier 2 classification */
export const MODEL_ID = "gemini-2.5-flash";

/**
 * Rule-based results at or above this confidence skip the LLM vision tier.
 * Below this threshold, the file is escalated to Tier 2 for deeper analysis.
 */
export const RULE_CONFIDENCE_THRESHOLD = 0.8;
