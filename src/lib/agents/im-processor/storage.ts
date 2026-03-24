import { db } from "@/lib/db";
import { companyProfiles, dealRedFlags, deals, pipelineStages, orgChartVersions, orgChartNodes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { RED_FLAG_DEFINITIONS } from "@/lib/scoring/red-flags";
import { MODEL_ID } from "./extraction";
import { computeScoresFromAnalysis } from "./consensus";
import { filterRedFlags } from "./red-flag-detection";
import type { IMAnalysisResult } from "./schema";

/** Store analysis results in the database */
export async function storeResults(
  dealId: string,
  portcoId: string,
  analysis: IMAnalysisResult
): Promise<string> {
  const { scoringBreakdown, weighted } = computeScoresFromAnalysis(analysis);
  const { confirmedFlags, confirmedGaps } = filterRedFlags(analysis);

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
      generatedAt: new Date(),
      modelVersion: MODEL_ID,
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
        generatedAt: new Date(),
        modelVersion: MODEL_ID,
        updatedAt: new Date(),
      },
    })
    .returning({ id: companyProfiles.id });

  // Delete existing AI-generated red flags for this deal, then insert new ones
  await db
    .delete(dealRedFlags)
    .where(eq(dealRedFlags.dealId, dealId));

  // Build flag rows from confirmed red flags + info gaps
  const flagRows = [
    ...confirmedFlags.map((flag) => {
      const def = RED_FLAG_DEFINITIONS.find((d) => d.id === flag.flagId)!;
      return {
        dealId,
        portcoId,
        flagId: flag.flagId,
        severity: def.severity,
        category: def.category,
        notes: flag.notes,
      };
    }),
    ...confirmedGaps.map((gap) => {
      const def = RED_FLAG_DEFINITIONS.find((d) => d.id === gap.flagId)!;
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
    // Get next version number for this deal
    const [latestVersion] = await db
      .select({ version: orgChartVersions.version })
      .from(orgChartVersions)
      .where(eq(orgChartVersions.dealId, dealId))
      .orderBy(desc(orgChartVersions.version))
      .limit(1);

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Deactivate previous versions
    await db
      .update(orgChartVersions)
      .set({ isActive: false })
      .where(
        and(
          eq(orgChartVersions.dealId, dealId),
          eq(orgChartVersions.isActive, true),
        )
      );

    // Create new version
    const [version] = await db
      .insert(orgChartVersions)
      .values({
        dealId,
        version: nextVersion,
        label: `AI extraction v${nextVersion}`,
        isActive: true,
      })
      .returning({ id: orgChartVersions.id });

    // Insert nodes — first pass: create all nodes
    const nodeIdMap = new Map<string, string>(); // name -> db id
    const nodes = analysis.managementTeam.map((member, i) => ({
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

    // Second pass: set parentId based on reportsTo
    for (const member of analysis.managementTeam) {
      if (member.reportsTo) {
        const nodeId = nodeIdMap.get(member.name);
        const parentId = nodeIdMap.get(member.reportsTo);
        if (nodeId && parentId) {
          await db
            .update(orgChartNodes)
            .set({ parentId })
            .where(eq(orgChartNodes.id, nodeId));
        }
      }
    }
  }

  return profile.id;
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

  // Fallback: get any first stage
  const [anyStage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(eq(pipelineStages.portcoId, portcoId))
    .orderBy(pipelineStages.position)
    .limit(1);

  if (anyStage) return anyStage.id;
  throw new Error("No pipeline stages found for this portco");
}

/** Try to extract a numeric value from a string like "250,000,000" or "250000000". Returns null for non-numeric text. */
export function parseNumericValue(value: string | null | undefined): string | null {
  if (!value) return null;
  // Strip commas, spaces, and common currency symbols
  const cleaned = value.replace(/[,\s¥$￥€£₩]/g, "");
  // Only attempt parse if the string is mostly digits (allow leading minus and decimal point)
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return cleaned;
}

/** Create a deal from IM analysis results */
export async function createDealFromAnalysis(
  portcoId: string,
  stageId: string,
  analysis: IMAnalysisResult,
  gdriveFileId: string,
  gdriveModifiedTime?: string | null,
): Promise<string> {
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
