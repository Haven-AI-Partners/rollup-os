import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getBaseTemplate } from "@/lib/thesis/template";
import type { FileType } from "@/lib/db/schema/files";

export const AGENT_SLUG = "dd-processor";

/** Build a description of the thesis tree nodes relevant to a given file type */
function buildRelevantNodes(fileType: FileType): string {
  const template = getBaseTemplate();

  // Map file types to the template node categories they can fill
  const relevanceMap: Record<string, string[]> = {
    dd_financial: [
      "revenue_composition", "revenue_channels", "retention", "revenue_per_employee",
      "product_profitability", "customer_satisfaction", "private_expenses", "capex",
      "financial_viability", "working_capital",
    ],
    dd_legal: [
      "litigation", "contracts", "ip_rights", "regulatory_compliance",
    ],
    dd_operational: [
      "existing_segments", "new_segments", "competitive_advantage",
      "new_development", "product_eol",
    ],
    dd_tax: [
      "financial_viability", "working_capital", "private_expenses",
    ],
    dd_hr: [
      "utilization", "hiring_needs", "sustainability", "labor_cost", "key_people",
    ],
    dd_it: [
      "competitive_advantage", "new_development", "product_eol", "regulatory_compliance",
    ],
  };

  const relevantIds = new Set(relevanceMap[fileType] ?? template.map((n) => n.id));

  return template
    .filter((n) => relevantIds.has(n.id))
    .map((n) => `- ${n.id}: ${n.label} — ${n.description}`)
    .join("\n");
}

export const DEFAULT_TEMPLATE = `You are an expert M&A due diligence analyst. You are extracting structured findings from a due diligence document to populate a DD thesis tree.

The thesis tree tracks key diligence items across categories like revenue, finance, product, organization, legal, market, and competition. Your job is to read this document and extract findings that map to specific thesis tree nodes.

## Document Type
This is a {{DOC_TYPE}} document.

## Thesis Tree Nodes (use these exact IDs)
The following nodes are most relevant to this document type. Map your findings to these node IDs:

{{RELEVANT_NODES}}

You may also map findings to other nodes if the document contains relevant information beyond its primary category.

## All Available Node IDs (for cross-category findings)
{{ALL_NODES}}

## Extraction Guidelines
- **Extract specific data points** — numbers, percentages, named entities, dates. Avoid vague summaries.
- **Status assignment:**
  - "complete" — this document fully answers the node's diligence question
  - "partial" — this document provides some data but gaps remain
  - "risk" — this finding reveals a concern that needs attention
- **Notes:** For partial findings, note what is still missing. For risk findings, describe the concern.
- **All output must be in English.** Translate Japanese content.
- **Only include nodes where the document has relevant information.** Do not force-fit findings.
- **Preserve specificity** — if the document says "revenue grew 12% YoY from ¥800M to ¥896M", include the full detail, not just "revenue grew".`;

const DOC_TYPE_LABELS: Record<string, string> = {
  dd_financial: "Financial Due Diligence",
  dd_legal: "Legal Due Diligence",
  dd_operational: "Operational Due Diligence",
  dd_tax: "Tax Due Diligence",
  dd_hr: "HR / People Due Diligence",
  dd_it: "IT / Technology Due Diligence",
  im_pdf: "Information Memorandum",
  report: "Report",
  other: "General Document",
};

function renderTemplate(
  template: string,
  fileType: FileType,
): string {
  const allTemplate = getBaseTemplate();
  const allNodes = allTemplate
    .filter((n) => n.parentId !== null) // skip root
    .map((n) => `- ${n.id}: ${n.label}`)
    .join("\n");

  return template
    .replace("{{DOC_TYPE}}", DOC_TYPE_LABELS[fileType] ?? fileType)
    .replace("{{RELEVANT_NODES}}", buildRelevantNodes(fileType))
    .replace("{{ALL_NODES}}", allNodes);
}

async function loadPromptFromDb(
  fileType: FileType,
  fallback: string,
): Promise<string> {
  try {
    const [active] = await db
      .select({ template: promptVersions.template })
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.agentSlug, AGENT_SLUG),
          eq(promptVersions.isActive, true),
        ),
      )
      .orderBy(desc(promptVersions.version))
      .limit(1);

    if (active) return renderTemplate(active.template, fileType);
  } catch {
    // DB not available — use default
  }
  return renderTemplate(fallback, fileType);
}

export async function buildDDProcessorPrompt(
  fileType: FileType,
): Promise<string> {
  return loadPromptFromDb(fileType, DEFAULT_TEMPLATE);
}
