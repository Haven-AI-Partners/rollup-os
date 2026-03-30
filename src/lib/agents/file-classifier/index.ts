import type { HybridClassificationResult } from "./schema";
import { classifyByRules } from "./rules";
import { RULE_CONFIDENCE_THRESHOLD } from "./constants";

export { MODEL_ID, RULE_CONFIDENCE_THRESHOLD } from "./constants";

interface ClassifyInput {
  fileName: string;
  mimeType: string;
  parentPath: string;
  /** Required for Tier 2 (vision) — file download from GDrive */
  portcoId?: string;
  /** Required for Tier 2 (vision) — file download from GDrive */
  gdriveFileId?: string;
}

/**
 * Hybrid file classifier: rule-based first, LLM vision fallback.
 *
 * Tier 1 (rules): Fast keyword matching on filename + folder path.
 *   - Returns immediately if confidence >= RULE_CONFIDENCE_THRESHOLD.
 *   - No company name extraction (suggestedCompanyName = null).
 *
 * Tier 2 (vision): Downloads first pages of PDF, sends to Gemini vision.
 *   - Triggered when rules don't match or confidence is too low.
 *   - Extracts both file type and company name from document content.
 *   - Falls back to metadata-only LLM if download fails.
 */
export async function classifyFile(
  input: ClassifyInput,
): Promise<HybridClassificationResult> {
  // Tier 1: Rule-based classification
  const ruleResult = classifyByRules({
    fileName: input.fileName,
    mimeType: input.mimeType,
    parentPath: input.parentPath,
  });

  if (ruleResult && ruleResult.confidence >= RULE_CONFIDENCE_THRESHOLD) {
    return {
      fileType: ruleResult.fileType,
      confidence: ruleResult.confidence,
      suggestedCompanyName: null,
      reasoning: `Rule match: ${ruleResult.matchedRule}`,
      tier: "rules",
    };
  }

  // Tier 2: LLM vision classification (lazy-loaded to avoid pdfjs-dist at module eval)
  if (input.portcoId && input.gdriveFileId) {
    try {
      const { classifyWithVision } = await import("./vision");
      const visionResult = await classifyWithVision({
        fileName: input.fileName,
        mimeType: input.mimeType,
        parentPath: input.parentPath,
        portcoId: input.portcoId,
        gdriveFileId: input.gdriveFileId,
      });
      return { ...visionResult, tier: "vision" };
    } catch {
      // Vision failed — fall through to rule result or default
    }
  }

  // If rules had a low-confidence match, use it as fallback
  if (ruleResult) {
    return {
      fileType: ruleResult.fileType,
      confidence: ruleResult.confidence,
      suggestedCompanyName: null,
      reasoning: `Rule match (low confidence): ${ruleResult.matchedRule}`,
      tier: "rules",
    };
  }

  // No classification possible
  return {
    fileType: "other",
    confidence: 0,
    suggestedCompanyName: null,
    reasoning: "No rule match and vision classification unavailable",
    tier: "rules",
  };
}

/**
 * Classify multiple files in batch.
 * Processes sequentially to avoid rate limits on the LLM API.
 */
export async function classifyFiles(
  inputs: ClassifyInput[],
): Promise<HybridClassificationResult[]> {
  const results: HybridClassificationResult[] = [];
  for (const input of inputs) {
    results.push(await classifyFile(input));
  }
  return results;
}
