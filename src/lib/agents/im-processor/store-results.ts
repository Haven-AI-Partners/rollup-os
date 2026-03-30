import { db } from "@/lib/db";
import { companyProfiles, dealRedFlags, deals, pipelineStages, orgChartVersions, orgChartNodes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { calculateWeightedScore } from "@/lib/scoring/rubric";
import { RED_FLAG_DEFINITIONS } from "@/lib/scoring/red-flags";
import { type IMAnalysisResult } from "./schema";
import { type IMPipelineResult } from "./schemas/pipeline-result";
import { extractSourceAttributions } from "./pipeline";

// ── Score computation ──

/** Extract dimension scores and build breakdown from analysis */
export function computeScoresFromAnalysis(analysis: IMAnalysisResult) {
  const scores: Record<string, number> = {};
  const scoringBreakdown: Record<string, {
    score: number;
    rationale: string;
    evidence: string;
    dataAvailable: boolean;
  }> = {};

  for (const [dimId, dimResult] of Object.entries(analysis.scoring) as Array<[string, { score: number; rationale: string; evidence: string; dataAvailable: boolean }]>) {
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

// ── Red flag filtering ──

/** Extract red flags and info gaps from analysis, filtering to known IDs */
export function filterRedFlags(analysis: IMAnalysisResult) {
  const knownIds = new Set(RED_FLAG_DEFINITIONS.map((f: { id: string }) => f.id));

  const confirmedFlags = analysis.redFlags.filter((f: { flagId: string }) => knownIds.has(f.flagId));
  const confirmedGaps = analysis.infoGaps.filter((g: { flagId: string }) => knownIds.has(g.flagId));

  return { confirmedFlags, confirmedGaps };
}

// ── DB storage (pipeline v2) ──

/** Store pipeline v2 results in the database */
export async function storePipelineResults(
  dealId: string,
  portcoId: string,
  pipelineResult: IMPipelineResult,
): Promise<string> {
  const analysis = pipelineResult.legacyAnalysis;
  const { scoringBreakdown, weighted } = computeScoresFromAnalysis(analysis);
  const { confirmedFlags, confirmedGaps } = filterRedFlags(analysis);
  const sourceAttributions = extractSourceAttributions(pipelineResult);

  // Upsert company profile
  const [profile] = await db
    .insert(companyProfiles)
    .values({
      dealId,
      summary: analysis.companyProfile.summary,
      businessModel: analysis.companyProfile.businessModel,
      marketPosition: analysis.companyProfile.marketPosition,
      industryTrends: analysis.companyProfile.industryTrends,
      strengths: analysis.companyProfile.strengths,
      keyRisks: analysis.companyProfile.keyRisks,
      financialHighlights: analysis.financialHighlights,
      aiOverallScore: weighted.toString(),
      scoringBreakdown,
      rawExtraction: analysis,
      // Pipeline v2 columns
      externalEnrichment: pipelineResult.externalEnrichment,
      sourceAttributions,
      rawContentExtraction: {
        contentExtraction: pipelineResult.contentExtraction,
        translation: pipelineResult.translation,
      },
      pipelineVersion: "v2",
      generatedAt: new Date(),
      modelVersion: pipelineResult.metadata.analyzerModel,
    })
    .onConflictDoUpdate({
      target: companyProfiles.dealId,
      set: {
        summary: analysis.companyProfile.summary,
        businessModel: analysis.companyProfile.businessModel,
        marketPosition: analysis.companyProfile.marketPosition,
        industryTrends: analysis.companyProfile.industryTrends,
        strengths: analysis.companyProfile.strengths,
        keyRisks: analysis.companyProfile.keyRisks,
        financialHighlights: analysis.financialHighlights,
        aiOverallScore: weighted.toString(),
        scoringBreakdown,
        rawExtraction: analysis,
        externalEnrichment: pipelineResult.externalEnrichment,
        sourceAttributions,
        rawContentExtraction: {
          contentExtraction: pipelineResult.contentExtraction,
          translation: pipelineResult.translation,
        },
        pipelineVersion: "v2",
        generatedAt: new Date(),
        modelVersion: pipelineResult.metadata.analyzerModel,
        updatedAt: new Date(),
      },
    })
    .returning({ id: companyProfiles.id });

  // Delete existing AI-generated red flags for this deal, then insert new ones
  await db
    .delete(dealRedFlags)
    .where(eq(dealRedFlags.dealId, dealId));

  const defMap = new Map(RED_FLAG_DEFINITIONS.map((d) => [d.id, d] as const));
  const flagRows = [
    ...confirmedFlags.map((flag: { flagId: string; notes: string }) => {
      const def = defMap.get(flag.flagId)!;
      return {
        dealId,
        portcoId,
        flagId: flag.flagId,
        severity: def.severity,
        category: def.category,
        notes: flag.notes,
      };
    }),
    ...confirmedGaps.map((gap: { flagId: string; notes: string }) => {
      const def = defMap.get(gap.flagId)!;
      return {
        dealId,
        portcoId,
        flagId: gap.flagId,
        severity: def.severity,
        category: def.category,
        notes: gap.notes,
      };
    }),
  ];

  if (flagRows.length > 0) {
    await db.insert(dealRedFlags).values(flagRows);
  }

  // Store org chart from management team extraction
  if (analysis.managementTeam && analysis.managementTeam.length > 0) {
    await storeOrgChart(dealId, analysis.managementTeam);
  }

  return profile.id;
}

/** Store org chart from management team data */
async function storeOrgChart(
  dealId: string,
  managementTeam: IMAnalysisResult["managementTeam"],
) {
  const [latestVersion] = await db
    .select({ version: orgChartVersions.version })
    .from(orgChartVersions)
    .where(eq(orgChartVersions.dealId, dealId))
    .orderBy(desc(orgChartVersions.version))
    .limit(1);

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  await db
    .update(orgChartVersions)
    .set({ isActive: false })
    .where(
      and(
        eq(orgChartVersions.dealId, dealId),
        eq(orgChartVersions.isActive, true),
      )
    );

  const [version] = await db
    .insert(orgChartVersions)
    .values({
      dealId,
      version: nextVersion,
      label: `AI extraction v${nextVersion}`,
      isActive: true,
    })
    .returning({ id: orgChartVersions.id });

  const nodeIdMap = new Map<string, string>();
  const nodes = managementTeam.map((member: IMAnalysisResult["managementTeam"][number], i: number) => ({
    versionId: version.id,
    name: member.name,
    title: member.title,
    department: member.department,
    role: member.role,
    position: i,
  }));

  const insertedNodes = await db
    .insert(orgChartNodes)
    .values(nodes)
    .returning({ id: orgChartNodes.id, name: orgChartNodes.name });

  for (const node of insertedNodes) {
    nodeIdMap.set(node.name, node.id);
  }

  type TeamMember = IMAnalysisResult["managementTeam"][number];
  const parentUpdates = managementTeam
    .filter((member: TeamMember) => member.reportsTo)
    .map((member: TeamMember) => {
      const nodeId = nodeIdMap.get(member.name);
      const parentId = nodeIdMap.get(member.reportsTo!);
      if (nodeId && parentId) {
        return db
          .update(orgChartNodes)
          .set({ parentId })
          .where(eq(orgChartNodes.id, nodeId));
      }
      return null;
    })
    .filter(Boolean);
  await Promise.all(parentUpdates);
}

// ── Deal creation/update helpers ──

/** Try to extract a numeric value from a string. Returns null for non-numeric text. */
export function parseNumericValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[,\s¥$￥€£₩]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return cleaned;
}

/** Get or create the first "sourcing" stage for a portco */
export async function getDefaultStageId(portcoId: string): Promise<string> {
  const [stage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(and(eq(pipelineStages.portcoId, portcoId), eq(pipelineStages.phase, "sourcing")))
    .orderBy(pipelineStages.position)
    .limit(1);

  if (stage) return stage.id;

  const [anyStage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(eq(pipelineStages.portcoId, portcoId))
    .orderBy(pipelineStages.position)
    .limit(1);

  if (anyStage) return anyStage.id;
  throw new Error("No pipeline stages found for this portco");
}

/** Create a deal from pipeline analysis results */
export async function createDealFromPipelineResult(
  portcoId: string,
  stageId: string,
  pipelineResult: IMPipelineResult,
  gdriveFileId: string,
  gdriveModifiedTime?: string | null,
): Promise<string> {
  const analysis = pipelineResult.legacyAnalysis;
  const fin = analysis.financialHighlights;
  const [deal] = await db
    .insert(deals)
    .values({
      portcoId,
      stageId,
      companyName: analysis.companyProfile.companyName,
      description: analysis.companyProfile.summary.slice(0, 500),
      source: "agent_scraped" as const,
      location: analysis.companyProfile.location ?? null,
      industry: analysis.companyProfile.industry ?? null,
      askingPrice: parseNumericValue(analysis.companyProfile.askingPrice),
      revenue: parseNumericValue(fin.revenue),
      ebitda: parseNumericValue(fin.ebitda),
      currency: fin.currency ?? "JPY",
      employeeCount: fin.employeeCount ?? null,
      fullTimeCount: fin.fullTimeCount ?? null,
      contractorCount: fin.contractorCount ?? null,
      status: "active",
      kanbanPosition: 0,
      metadata: {
        gdriveSourceFileId: gdriveFileId,
        currency: fin.currency ?? null,
        askingPriceRaw: analysis.companyProfile.askingPrice ?? null,
        revenueRaw: fin.revenue ?? null,
        ebitdaRaw: fin.ebitda ?? null,
      },
      ...(gdriveModifiedTime ? { createdAt: new Date(gdriveModifiedTime) } : {}),
    })
    .returning({ id: deals.id });

  return deal.id;
}

/** Update an existing deal from pipeline analysis results */
export async function updateDealFromPipelineResult(
  dealId: string,
  pipelineResult: IMPipelineResult,
  gdriveFileId: string,
) {
  const analysis = pipelineResult.legacyAnalysis;
  const fin = analysis.financialHighlights;
  await db
    .update(deals)
    .set({
      companyName: analysis.companyProfile.companyName,
      description: analysis.companyProfile.summary.slice(0, 500),
      location: analysis.companyProfile.location ?? null,
      industry: analysis.companyProfile.industry ?? null,
      askingPrice: parseNumericValue(analysis.companyProfile.askingPrice),
      revenue: parseNumericValue(fin.revenue),
      ebitda: parseNumericValue(fin.ebitda),
      currency: fin.currency ?? "JPY",
      employeeCount: fin.employeeCount ?? null,
      fullTimeCount: fin.fullTimeCount ?? null,
      contractorCount: fin.contractorCount ?? null,
      metadata: {
        gdriveSourceFileId: gdriveFileId,
        currency: fin.currency ?? null,
        askingPriceRaw: analysis.companyProfile.askingPrice ?? null,
        revenueRaw: fin.revenue ?? null,
        ebitdaRaw: fin.ebitda ?? null,
      },
      updatedAt: new Date(),
    })
    .where(eq(deals.id, dealId));
}
