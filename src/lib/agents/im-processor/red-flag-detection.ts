import { RED_FLAG_DEFINITIONS } from "@/lib/scoring/red-flags";
import type { IMAnalysisResult } from "./schema";

/** Extract red flags and info gaps from analysis, filtering to known IDs */
export function filterRedFlags(analysis: IMAnalysisResult) {
  const knownIds = new Set(RED_FLAG_DEFINITIONS.map((f) => f.id));

  const confirmedFlags = analysis.redFlags.filter((f) => knownIds.has(f.flagId));
  const confirmedGaps = analysis.infoGaps.filter((g) => knownIds.has(g.flagId));

  return { confirmedFlags, confirmedGaps };
}
