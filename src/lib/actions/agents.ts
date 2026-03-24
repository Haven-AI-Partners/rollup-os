"use server";

import { db } from "@/lib/db";
import { files, deals, companyProfiles, promptVersions, evalRuns } from "@/lib/db/schema";
import { eq, and, count, desc, avg } from "drizzle-orm";
import {
  AGENT_SLUG,
  EXTRACTION_SLUG,
  SCORING_SLUG,
} from "@/lib/agents/im-processor/prompt";
import { requireAuth } from "@/lib/auth";

export async function getAgentStats(portcoId: string) {
  await requireAuth();

  const [statusCounts, scoreStats] = await Promise.all([
    db
      .select({
        status: files.processingStatus,
        count: count(files.id),
      })
      .from(files)
      .where(eq(files.portcoId, portcoId))
      .groupBy(files.processingStatus),

    db
      .select({
        avgScore: avg(companyProfiles.aiOverallScore),
      })
      .from(companyProfiles)
      .innerJoin(deals, eq(companyProfiles.dealId, deals.id))
      .where(eq(deals.portcoId, portcoId)),
  ]);

  const statusMap = new Map(statusCounts.map((s) => [s.status, Number(s.count)]));
  const completed = statusMap.get("completed") ?? 0;
  const failed = statusMap.get("failed") ?? 0;
  const processing = statusMap.get("processing") ?? 0;
  const pending = statusMap.get("pending") ?? 0;

  return {
    total: completed + failed + processing + pending,
    completed,
    failed,
    inProgress: processing + pending,
    avgScore: scoreStats[0]?.avgScore ? Number(scoreStats[0].avgScore) : null,
  };
}

export async function getRecentProcessedFiles(portcoId: string) {
  await requireAuth();
  return db
    .select({
      fileId: files.id,
      fileName: files.fileName,
      status: files.processingStatus,
      processedAt: files.processedAt,
      dealId: files.dealId,
      companyName: deals.companyName,
      aiScore: companyProfiles.aiOverallScore,
    })
    .from(files)
    .innerJoin(deals, eq(files.dealId, deals.id))
    .leftJoin(companyProfiles, eq(companyProfiles.dealId, deals.id))
    .where(eq(files.portcoId, portcoId))
    .orderBy(desc(files.updatedAt))
    .limit(3);
}

export async function getProcessedFilesForEval(portcoId: string) {
  await requireAuth();
  return db
    .select({
      id: files.id,
      fileName: files.fileName,
      dealId: files.dealId,
      companyName: deals.companyName,
    })
    .from(files)
    .innerJoin(deals, eq(files.dealId, deals.id))
    .where(and(eq(files.portcoId, portcoId), eq(files.processingStatus, "completed")))
    .orderBy(desc(files.processedAt));
}

export async function getRecentEvalRuns() {
  await requireAuth();
  return db
    .select({
      id: evalRuns.id,
      fileName: evalRuns.fileName,
      iterations: evalRuns.iterations,
      status: evalRuns.status,
      overallScoreStdDev: evalRuns.overallScoreStdDev,
      flagAgreementRate: evalRuns.flagAgreementRate,
      nameConsistent: evalRuns.nameConsistent,
      scoreVariance: evalRuns.scoreVariance,
      promptVersionLabel: evalRuns.promptVersionLabel,
      modelId: evalRuns.modelId,
      createdAt: evalRuns.createdAt,
      completedAt: evalRuns.completedAt,
    })
    .from(evalRuns)
    .where(eq(evalRuns.agentSlug, AGENT_SLUG))
    .orderBy(desc(evalRuns.createdAt))
    .limit(10);
}

function getPromptVersionsForSlug(agentSlug: string) {
  return db
    .select({
      id: promptVersions.id,
      version: promptVersions.version,
      template: promptVersions.template,
      isActive: promptVersions.isActive,
      changeNote: promptVersions.changeNote,
      createdAt: promptVersions.createdAt,
    })
    .from(promptVersions)
    .where(eq(promptVersions.agentSlug, agentSlug))
    .orderBy(desc(promptVersions.version));
}

export async function getAllPromptVersions() {
  await requireAuth();

  const [extractionVersions, scoringVersions, legacyVersions] = await Promise.all([
    getPromptVersionsForSlug(EXTRACTION_SLUG),
    getPromptVersionsForSlug(SCORING_SLUG),
    getPromptVersionsForSlug(AGENT_SLUG),
  ]);

  return { extractionVersions, scoringVersions, legacyVersions };
}
