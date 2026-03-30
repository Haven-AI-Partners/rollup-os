import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { type TranslationResult, type TranslatedPage } from "../schemas/translator";
import {
  analyzerExtractionSchema,
  analyzerScoringSchema,
  flattenSourcedExtraction,
  type AnalyzerExtractionResult,
  type AnalyzerScoringResult,
  type AnalyzerResult,
} from "../schemas/analyzer";
import { buildAnalyzerExtractionPrompt, buildAnalyzerScoringPrompt } from "../prompts/analyzer";

/**
 * Agent 3: Analyzer
 *
 * Takes translated IM pages and produces:
 * 1. Structured extraction with source attribution (sub-pass 1)
 * 2. Scoring with consensus voting (sub-pass 2, 3x parallel)
 *
 * Uses ONLY information from the IM document pages. No external knowledge.
 */
export const MODEL_ID = "gemini-2.5-flash";

/** Number of parallel scoring passes for majority voting */
const SCORING_VOTES = 3;

// ── Sub-pass 1: Structured extraction with source attribution ──

export async function extractStructured(
  translation: TranslationResult,
): Promise<AnalyzerExtractionResult> {
  const pagesText = translation.pages
    .map((p: TranslatedPage) => `--- Page ${p.pageNumber} ---\n${p.translatedContent}`)
    .join("\n\n");

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: analyzerExtractionSchema,
    system: await buildAnalyzerExtractionPrompt(),
    messages: [
      {
        role: "user",
        content: `Extract all structured information from these IM pages. For every data point, cite the page number and quote.\n\n${pagesText}`,
      },
    ],
    temperature: 0,
    seed: 42,
  });

  return object;
}

// ── Sub-pass 2: Scoring with consensus voting ──

async function scoreExtraction(
  extraction: AnalyzerExtractionResult,
  seed: number = 42,
): Promise<AnalyzerScoringResult> {
  // Flatten sourced extraction to a simpler format for the scoring model
  const flatExtraction = flattenSourcedExtraction(extraction);

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: analyzerScoringSchema,
    system: await buildAnalyzerScoringPrompt(),
    messages: [
      {
        role: "user",
        content: `Score this company based on the following extraction:\n\n${JSON.stringify(flatExtraction, null, 2)}`,
      },
    ],
    temperature: 0,
    seed,
  });

  return object;
}

/**
 * Run scoring multiple times in parallel and majority-vote the results.
 * - Scores: median per dimension
 * - Red flags: keep only flags appearing in majority (2/3+) of runs
 * - Info gaps: same majority rule
 * - Rationale/evidence: taken from the run whose scores are closest to the medians
 */
async function scoreWithConsensus(
  extraction: AnalyzerExtractionResult,
): Promise<AnalyzerScoringResult> {
  const results = await Promise.all(
    Array.from({ length: SCORING_VOTES }, (_, i) =>
      scoreExtraction(extraction, 42 + i)
    )
  );

  // 1. Median scores per dimension
  type ScoringMap = AnalyzerScoringResult["scoring"];
  type DimensionId = string & keyof ScoringMap;
  const dimensionIds = Object.keys(results[0].scoring) as DimensionId[];
  const medianScores: Record<string, number> = {};

  for (const dimId of dimensionIds) {
    const scores = results.map((r: AnalyzerScoringResult) => r.scoring[dimId].score).sort((a: number, b: number) => a - b);
    medianScores[dimId] = scores[Math.floor(scores.length / 2)];
  }

  // 2. Pick the "best representative" run (closest to medians)
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < results.length; i++) {
    let dist = 0;
    for (const dimId of dimensionIds) {
      dist += Math.abs(results[i].scoring[dimId].score - (medianScores[dimId] ?? 0));
    }
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  // Build scoring with median scores but rationale/evidence from best representative
  const scoring = {} as ScoringMap;
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

  // 4. Majority-vote info gaps
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
 * Full analyzer pipeline:
 * 1. Extract structured data with source attribution
 * 2. Score with consensus voting (3x parallel)
 */
export async function analyzeContent(
  translation: TranslationResult,
): Promise<AnalyzerResult> {
  const extraction = await extractStructured(translation);
  const scoring = await scoreWithConsensus(extraction);
  return { extraction, scoring };
}
