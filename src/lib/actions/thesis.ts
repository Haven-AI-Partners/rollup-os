"use server";

import { db } from "@/lib/db";
import { dealThesisNodes, companyProfiles } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getBaseTemplate } from "@/lib/thesis/template";
import type { IMAnalysisResult } from "@/lib/agents/im-processor/schema";
import { generateIndustryNodes, insertGeneratedNodes } from "@/lib/agents/thesis-generator";

async function createThesisTreeForDeal(dealId: string, portcoId: string): Promise<number> {
  const template = getBaseTemplate();

  // Check if thesis already exists
  const existing = await db
    .select({ id: dealThesisNodes.id })
    .from(dealThesisNodes)
    .where(eq(dealThesisNodes.dealId, dealId))
    .limit(1);

  if (existing.length > 0) return 0;

  // Load company profile for pre-fill
  const [profile] = await db
    .select({ rawExtraction: companyProfiles.rawExtraction })
    .from(companyProfiles)
    .where(eq(companyProfiles.dealId, dealId))
    .limit(1);

  const extraction = profile?.rawExtraction as IMAnalysisResult | null;

  // Map template IDs to generated UUIDs for parent references
  const idMap = new Map<string, string>();
  const rows = template.map((node) => {
    const id = crypto.randomUUID();
    idMap.set(node.id, id);
    return { ...node, generatedId: id };
  });

  // Identify leaf nodes (no children in template)
  const parentIds = new Set(template.filter((n) => n.parentId).map((n) => n.parentId));
  const isLeaf = (nodeId: string) => !parentIds.has(nodeId);

  const inserts = rows.map((node) => {
    const preFill = extraction ? getPreFillForNode(node.id, extraction) : null;
    const leaf = isLeaf(node.id);
    return {
      id: node.generatedId,
      dealId,
      portcoId,
      parentId: node.parentId ? idMap.get(node.parentId) ?? null : null,
      label: node.label,
      description: node.description,
      status: preFill?.status ?? ("unknown" as const),
      value: preFill?.value ?? null,
      notes: preFill?.notes ?? (leaf && !preFill ? `Missing: ${node.description}` : null),
      source: preFill ? ("im_extracted" as const) : null,
      sortOrder: node.sortOrder,
      templateNodeId: node.id,
    };
  });

  await db.insert(dealThesisNodes).values(inserts);

  // Auto-enhance with AI if a company profile exists
  let aiCount = 0;
  if (extraction) {
    try {
      const result = await generateIndustryNodes({ dealId, portcoId });
      aiCount = await insertGeneratedNodes(dealId, portcoId, result);
    } catch (e) {
      console.error("AI enhancement failed (base tree still created):", e);
    }
  }

  return inserts.length + aiCount;
}

/** Server action: generate thesis tree (called from UI) */
export async function generateThesisTree(
  dealId: string,
  portcoId: string,
  portcoSlug: string,
) {
  await getCurrentUser();
  const count = await createThesisTreeForDeal(dealId, portcoId);
  if (count === 0) throw new Error("Thesis tree already exists for this deal");
  revalidatePath(`/${portcoSlug}/pipeline/${dealId}/thesis`);
  return { count };
}

/** Auto-generate thesis tree (called from IM processor, no auth needed) */
export async function autoGenerateThesisTree(dealId: string, portcoId: string) {
  return createThesisTreeForDeal(dealId, portcoId);
}

export async function updateThesisNode(
  nodeId: string,
  portcoSlug: string,
  dealId: string,
  data: {
    status?: "unknown" | "partial" | "complete" | "risk";
    value?: string | null;
    notes?: string | null;
    source?: "im_extracted" | "manual" | "agent_generated" | "interview" | null;
    sourceDetail?: string | null;
  },
) {
  await getCurrentUser();

  await db
    .update(dealThesisNodes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(dealThesisNodes.id, nodeId));

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}/thesis`);
}

export async function addThesisNode(
  dealId: string,
  portcoId: string,
  portcoSlug: string,
  data: {
    parentId: string;
    label: string;
    description?: string;
    sortOrder?: number;
  },
) {
  await getCurrentUser();

  const [node] = await db
    .insert(dealThesisNodes)
    .values({
      dealId,
      portcoId,
      parentId: data.parentId,
      label: data.label,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
      source: "manual",
    })
    .returning({ id: dealThesisNodes.id });

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}/thesis`);

  return node;
}

export async function removeThesisNode(
  nodeId: string,
  portcoSlug: string,
  dealId: string,
) {
  await getCurrentUser();

  // Only allow deleting non-template nodes
  const [node] = await db
    .select({ templateNodeId: dealThesisNodes.templateNodeId })
    .from(dealThesisNodes)
    .where(eq(dealThesisNodes.id, nodeId))
    .limit(1);

  if (node?.templateNodeId) {
    throw new Error("Cannot delete base template nodes");
  }

  // Delete node and all descendants recursively
  await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM deal_thesis_nodes WHERE id = ${nodeId}::uuid
      UNION ALL
      SELECT n.id FROM deal_thesis_nodes n
      INNER JOIN descendants d ON n.parent_id = d.id
    )
    DELETE FROM deal_thesis_nodes WHERE id IN (SELECT id FROM descendants)
  `);

  revalidatePath(`/${portcoSlug}/pipeline/${dealId}/thesis`);
}


// ── Pre-fill logic ──

function getPreFillForNode(
  templateNodeId: string,
  extraction: IMAnalysisResult,
): { status: "partial" | "complete"; value: string; notes: string | null } | null {
  const fin = extraction.financialHighlights;
  const profile = extraction.companyProfile;

  switch (templateNodeId) {
    case "revenue_composition": {
      const parts: string[] = [];
      if (fin.revenue) parts.push(`Revenue: ${formatCurrency(fin.revenue, fin.currency)}`);
      if (fin.recurringRevenue) parts.push(`Recurring: ${fin.recurringRevenue}`);
      if (fin.revenueGrowth) parts.push(`Growth: ${fin.revenueGrowth}`);
      if (parts.length === 0) return null;
      const missing: string[] = [];
      if (!fin.revenue) missing.push("total revenue");
      if (!fin.recurringRevenue) missing.push("recurring vs. one-time split");
      if (!fin.revenueGrowth) missing.push("YoY growth rate");
      return {
        status: parts.length >= 2 ? "complete" : "partial",
        value: parts.join(" / "),
        notes: missing.length > 0 ? `Missing: ${missing.join(", ")}` : null,
      };
    }

    case "retention": {
      if (fin.topClientConcentration) {
        return {
          status: "partial",
          value: `Top client: ${fin.topClientConcentration}`,
          notes: "Missing: churn rate, contract renewal rate, customer lifetime data",
        };
      }
      return null;
    }

    case "revenue_per_employee": {
      if (fin.revenue && fin.employeeCount) {
        const rev = Number(fin.revenue);
        const perEmp = Math.round(rev / fin.employeeCount);
        return {
          status: "complete",
          value: `${formatCurrency(String(perEmp), fin.currency)} (${fin.employeeCount} employees)`,
          notes: null,
        };
      }
      return null;
    }

    case "financial_viability": {
      const parts: string[] = [];
      if (fin.ebitda) parts.push(`EBITDA: ${formatCurrency(fin.ebitda, fin.currency)}`);
      if (fin.ebitdaMargin) parts.push(`Margin: ${fin.ebitdaMargin}`);
      if (fin.operatingMargin) parts.push(`Operating margin: ${fin.operatingMargin}`);
      if (parts.length === 0) return null;
      const missing: string[] = [];
      if (!fin.ebitda) missing.push("EBITDA");
      if (!fin.ebitdaMargin) missing.push("EBITDA margin");
      if (!fin.operatingMargin) missing.push("operating margin");
      return {
        status: parts.length >= 2 ? "complete" : "partial",
        value: parts.join(" / "),
        notes: missing.length > 0 ? `Missing: ${missing.join(", ")}` : null,
      };
    }

    case "working_capital": {
      if (fin.debtLevel) {
        return {
          status: "partial",
          value: `Debt: ${fin.debtLevel}`,
          notes: "Missing: working capital breakdown, AR/AP aging, inventory levels",
        };
      }
      return null;
    }

    case "competitive_advantage": {
      if (profile.marketPosition) {
        return {
          status: "partial",
          value: profile.marketPosition,
          notes: "Missing: quantified moat metrics, switching costs, proprietary technology details",
        };
      }
      return null;
    }

    case "market_size": {
      if (profile.industryTrends) {
        return {
          status: "partial",
          value: profile.industryTrends,
          notes: "Missing: TAM/SAM/SOM figures, market growth rate, third-party research sources",
        };
      }
      return null;
    }

    case "direct_competition": {
      if (profile.marketPosition) {
        return {
          status: "partial",
          value: profile.marketPosition,
          notes: "Missing: named competitors, market share data, competitive positioning map",
        };
      }
      return null;
    }

    case "hiring_needs": {
      if (fin.employeeCount) {
        return {
          status: "partial",
          value: `Current headcount: ${fin.employeeCount}`,
          notes: "Missing: open positions, planned hires, turnover rate, hiring difficulty",
        };
      }
      return null;
    }

    case "key_people": {
      if (extraction.managementTeam && extraction.managementTeam.length > 0) {
        const top = extraction.managementTeam.slice(0, 3);
        return {
          status: "partial",
          value: top.map((m) => `${m.name} (${translateTitle(m.title)})`).join(", "),
          notes: "Missing: succession plan, non-compete agreements, retention risk assessment",
        };
      }
      return null;
    }

    default:
      return null;
  }
}

const JP_TITLE_MAP: Record<string, string> = {
  "代表取締役会長": "Chairman",
  "代表取締役社長": "President & CEO",
  "代表取締役": "Representative Director",
  "取締役会長": "Chairman",
  "取締役社長": "President",
  "取締役副社長": "Executive Vice President",
  "専務取締役": "Senior Managing Director",
  "常務取締役": "Managing Director",
  "取締役": "Director",
  "社外取締役": "Outside Director",
  "監査役": "Auditor",
  "社外監査役": "Outside Auditor",
  "執行役員": "Executive Officer",
  "上席執行役員": "Senior Executive Officer",
  "常務執行役員": "Managing Executive Officer",
  "専務執行役員": "Senior Managing Executive Officer",
  "相談役": "Senior Advisor",
  "顧問": "Advisor",
  "部長": "General Manager",
  "次長": "Deputy General Manager",
  "課長": "Manager",
  "係長": "Section Chief",
  "主任": "Supervisor",
  "CFO": "CFO",
  "CTO": "CTO",
  "COO": "COO",
  "CIO": "CIO",
};

function translateTitle(title: string): string {
  // Check for exact match first
  if (JP_TITLE_MAP[title]) return JP_TITLE_MAP[title];
  // Try matching known patterns within the title (e.g. "取締役 COO")
  for (const [jp, en] of Object.entries(JP_TITLE_MAP)) {
    if (title.includes(jp)) {
      return title.replace(jp, en).trim();
    }
  }
  return title;
}

function formatCurrency(amount: string, currency: string | null): string {
  const num = Number(amount);
  if (isNaN(num)) return amount;
  const c = currency ?? "JPY";
  if (c === "JPY") {
    if (num >= 100_000_000) return `${(num / 100_000_000).toFixed(1)}億円`;
    if (num >= 10_000) return `${(num / 10_000).toFixed(0)}万円`;
    return `${num.toLocaleString()}円`;
  }
  return `${c} ${num.toLocaleString()}`;
}
