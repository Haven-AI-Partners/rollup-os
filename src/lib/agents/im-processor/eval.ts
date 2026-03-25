import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { evalRuns, evalIterations, files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { downloadFile } from "@/lib/gdrive/client";


import { buildExtractionPrompt, buildScoringPrompt } from "./prompt";
import {
  imExtractionSchema,
  imScoringSchema,
  mergeResults,
  type IMExtractionResult,
  type IMScoringResult,
} from "./schema";
import { MODEL_ID, computeScoresFromAnalysis } from "./index";

interface EvalResult {
  evalRunId: string;
  status: "completed" | "failed";
  error?: string;
}

/** Pass 1 for eval: extract facts from PDF with per-iteration seed */
async function extractForEval(
  pdfBuffer: Buffer,
  systemPrompt: string,
  iteration: number,
): Promise<IMExtractionResult> {
  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: imExtractionSchema,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: pdfBuffer,
            mediaType: "application/pdf",
          },
          {
            type: "text",
            text: "Extract all facts from this Information Memorandum document.",
          },
        ],
      },
    ],
    temperature: 0.1,
    seed: iteration + 1,
  });

  return object;
}

/** Pass 2 for eval: score extraction with per-iteration seed */
async function scoreForEval(
  extraction: IMExtractionResult,
  systemPrompt: string,
  iteration: number,
): Promise<IMScoringResult> {
  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: imScoringSchema,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Score this company based on the following extraction:\n\n${JSON.stringify(extraction, null, 2)}`,
          },
        ],
      },
    ],
    temperature: 0.1,
    seed: iteration + 1,
  });

  return object;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Run an eval: process the same file N times and compare results.
 *
 * scoringOnly mode: extract once, score N times. Isolates scoring variance.
 * Full mode (default): extract + score N times. Measures end-to-end variance.
 */
export async function runEval(
  evalRunId: string,
  fileId: string,
  portcoId: string,
  iterations: number,
  scoringOnly: boolean = false,
): Promise<EvalResult> {
  try {
    // Get the file record
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file || !file.gdriveFileId) {
      await db.update(evalRuns).set({ status: "failed", error: "File not found or no GDrive ID" }).where(eq(evalRuns.id, evalRunId));
      return { evalRunId, status: "failed", error: "File not found" };
    }

    // Download PDF once
    const buffer = await downloadFile(portcoId, file.gdriveFileId);
    if (!buffer) {
      await db.update(evalRuns).set({ status: "failed", error: "Failed to download PDF" }).where(eq(evalRuns.id, evalRunId));
      return { evalRunId, status: "failed", error: "Download failed" };
    }

    // Build prompts once (parallel)
    const [extractionPrompt, scoringPrompt] = await Promise.all([
      buildExtractionPrompt(),
      buildScoringPrompt(),
    ]);

    // In scoring-only mode, extract once and reuse
    let fixedExtraction: IMExtractionResult | null = null;
    if (scoringOnly) {
      fixedExtraction = await extractForEval(buffer, extractionPrompt, 0);
    }

    // Run N iterations
    const results: Array<{
      companyName: string;
      overallScore: number;
      scores: Record<string, number>;
      redFlagIds: string[];
      infoGapIds: string[];
    }> = [];

    const iterationResults = await Promise.all(
      Array.from({ length: iterations }, async (_, i) => {
        const extraction = fixedExtraction ?? await extractForEval(buffer, extractionPrompt, i);
        const scoring = await scoreForEval(extraction, scoringPrompt, i);
        const analysis = mergeResults(extraction, scoring);

        const { scores, weighted } = computeScoresFromAnalysis(analysis);

        const redFlagIds = analysis.redFlags.map((f) => f.flagId);
        const infoGapIds = analysis.infoGaps.map((g) => g.flagId);

        const result = {
          companyName: analysis.companyProfile.companyName,
          overallScore: weighted,
          scores,
          redFlagIds,
          infoGapIds,
        };

        // Store iteration
        await db.insert(evalIterations).values({
          evalRunId,
          iteration: i + 1,
          companyName: result.companyName,
          overallScore: result.overallScore.toString(),
          scores: result.scores,
          redFlagIds: result.redFlagIds,
          infoGapIds: result.infoGapIds,
        });

        return result;
      })
    );
    results.push(...iterationResults);

    // Compute metrics
    // 1. Per-dimension score std dev
    const dimensionIds = Object.keys(results[0].scores);
    const scoreVariance: Record<string, number> = {};
    for (const dimId of dimensionIds) {
      const values = results.map((r) => r.scores[dimId]);
      scoreVariance[dimId] = Number(stdDev(values).toFixed(3));
    }

    // 2. Overall score std dev
    const overallScores = results.map((r) => r.overallScore);
    const overallStdDev = stdDev(overallScores);

    // 3. Red flag agreement rate
    const allFlags = new Set<string>();
    for (const r of results) {
      for (const f of [...r.redFlagIds, ...r.infoGapIds]) {
        allFlags.add(f);
      }
    }
    let unanimousFlags = 0;
    for (const flagId of allFlags) {
      const inAll = results.every(
        (r) => r.redFlagIds.includes(flagId) || r.infoGapIds.includes(flagId)
      );
      if (inAll) unanimousFlags++;
    }
    const flagAgreementRate = allFlags.size > 0 ? unanimousFlags / allFlags.size : 1;

    // 4. Name consistency
    const names = results.map((r) => r.companyName);
    const uniqueNames = [...new Set(names)];
    const nameConsistent = uniqueNames.length === 1
      ? uniqueNames[0]
      : `${uniqueNames.length} variants: ${uniqueNames.join(", ")}`;

    // Update eval run with metrics
    await db
      .update(evalRuns)
      .set({
        status: "completed",
        scoreVariance,
        overallScoreStdDev: overallStdDev.toFixed(3),
        flagAgreementRate: flagAgreementRate.toFixed(3),
        nameConsistent,
        completedAt: new Date(),
      })
      .where(eq(evalRuns.id, evalRunId));

    return { evalRunId, status: "completed" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(evalRuns)
      .set({ status: "failed", error: errorMsg, completedAt: new Date() })
      .where(eq(evalRuns.id, evalRunId))
      .catch(() => {});
    return { evalRunId, status: "failed", error: errorMsg };
  }
}
