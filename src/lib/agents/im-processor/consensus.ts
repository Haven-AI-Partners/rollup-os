import { extractFromIM, scoreExtraction } from "./extraction";
import { calculateWeightedScore } from "@/lib/scoring/rubric";
import { mergeResults, type IMAnalysisResult, type IMExtractionResult, type IMScoringResult } from "./schema";

/** Number of parallel scoring passes for majority voting */
export const SCORING_VOTES = 3;

/**
 * Run Pass 2 multiple times in parallel and majority-vote the results.
 * - Scores: median per dimension
 * - Red flags: keep only flags appearing in majority (2/3+) of runs
 * - Info gaps: same majority rule
 * - Rationale/evidence: taken from the run whose scores are closest to the medians
 */
export async function scoreWithConsensus(extraction: IMExtractionResult): Promise<IMScoringResult> {
  // Run scoring passes in parallel with different seeds
  const results = await Promise.all(
    Array.from({ length: SCORING_VOTES }, (_, i) =>
      scoreExtraction(extraction, 42 + i)
    )
  );

  // 1. Median scores per dimension
  const dimensionIds = Object.keys(results[0].scoring) as Array<keyof typeof results[0]["scoring"]>;
  const medianScores: Record<string, number> = {};

  for (const dimId of dimensionIds) {
    const scores = results.map((r) => r.scoring[dimId].score).sort((a, b) => a - b);
    medianScores[dimId] = scores[Math.floor(scores.length / 2)];
  }

  // 2. Pick the "best representative" run — the one whose scores are closest to the medians
  // This gives us coherent rationale/evidence that matches the consensus scores
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < results.length; i++) {
    let dist = 0;
    for (const dimId of dimensionIds) {
      dist += Math.abs(results[i].scoring[dimId].score - medianScores[dimId]);
    }
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  // Build scoring with median scores but rationale/evidence from best representative
  const scoring = {} as IMScoringResult["scoring"];
  for (const dimId of dimensionIds) {
    const representative = results[bestIdx].scoring[dimId];
    (scoring as Record<string, unknown>)[dimId] = {
      score: medianScores[dimId],
      rationale: representative.rationale,
      evidence: representative.evidence,
      dataAvailable: representative.dataAvailable,
    };
  }

  // 3. Majority-vote red flags (appear in 2/3+ runs)
  const flagCounts = new Map<string, { count: number; notes: string }>();
  for (const result of results) {
    for (const flag of result.redFlags) {
      const existing = flagCounts.get(flag.flagId);
      if (existing) {
        existing.count++;
      } else {
        flagCounts.set(flag.flagId, { count: 1, notes: flag.notes });
      }
    }
  }
  const majority = Math.ceil(SCORING_VOTES / 2);
  const redFlags = Array.from(flagCounts.entries())
    .filter(([, v]) => v.count >= majority)
    .map(([flagId, v]) => ({ flagId, notes: v.notes }));

  // 4. Majority-vote info gaps (same rule)
  const gapCounts = new Map<string, { count: number; notes: string }>();
  for (const result of results) {
    for (const gap of result.infoGaps) {
      const existing = gapCounts.get(gap.flagId);
      if (existing) {
        existing.count++;
      } else {
        gapCounts.set(gap.flagId, { count: 1, notes: gap.notes });
      }
    }
  }
  const infoGaps = Array.from(gapCounts.entries())
    .filter(([, v]) => v.count >= majority)
    .map(([flagId, v]) => ({ flagId, notes: v.notes }));

  return { scoring, redFlags, infoGaps };
}

/**
 * Two-pass IM analysis with majority-vote consensus:
 * 1. Extract facts from PDF (once, multimodal)
 * 2. Score from structured data (3x parallel, majority-vote flags, median scores)
 */
export async function analyzeIM(pdfBuffer: Buffer): Promise<IMAnalysisResult> {
  const extraction = await extractFromIM(pdfBuffer);
  const scoring = await scoreWithConsensus(extraction);
  return mergeResults(extraction, scoring);
}

/** Extract dimension scores and build breakdown from analysis */
export function computeScoresFromAnalysis(analysis: IMAnalysisResult) {
  const scores: Record<string, number> = {};
  const scoringBreakdown: Record<string, {
    score: number;
    rationale: string;
    evidence: string;
    dataAvailable: boolean;
  }> = {};

  for (const [dimId, dimResult] of Object.entries(analysis.scoring)) {
    scores[dimId] = dimResult.score;
    scoringBreakdown[dimId] = {
      score: dimResult.score,
      rationale: dimResult.rationale,
      evidence: dimResult.evidence,
      dataAvailable: dimResult.dataAvailable,
    };
  }

  const { weighted } = calculateWeightedScore(scores);
  return { scores, scoringBreakdown, weighted };
}
