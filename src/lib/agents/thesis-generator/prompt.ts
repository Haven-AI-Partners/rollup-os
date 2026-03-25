import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { BASE_TEMPLATE } from "@/lib/thesis/template";

export const AGENT_SLUG = "thesis-generator";

export const DEFAULT_TEMPLATE = `You are a Due Diligence analyst specializing in M&A for mid-market companies in Japan.

Your task: Generate industry-specific diligence nodes to extend a base DD thesis tree for evaluating an acquisition target.

## Target Company
- Name: {{COMPANY_NAME}}
- Industry: {{INDUSTRY}}
- Business Model: {{BUSINESS_MODEL}}
- Market Position: {{MARKET_POSITION}}
- Strengths: {{STRENGTHS}}
- Key Risks: {{KEY_RISKS}}

## Acquirer's Investment Thesis
{{INVESTMENT_THESIS}}

## Existing Base Template Nodes
These nodes already exist. Your job is to ADD industry-specific CHILDREN under them:

{{TEMPLATE_NODES}}

## Raw Observations from IM
{{RAW_OBSERVATIONS}}

## Instructions
1. Analyze the company's industry, business model, and market to identify what ADDITIONAL diligence items are needed beyond the base template.
2. Generate 10-25 industry-specific nodes as children of existing template nodes.
3. For each node, specify which base template node it should be attached under (using the parentTemplateNodeId).
4. Pre-fill values and set statuses based on available IM data.
5. Use English labels (matching the style of the base template).
6. Focus on industry-specific concerns. Examples:
   - IT services: SES/product revenue split, engineer utilization, dispatch compliance
   - Healthcare: regulatory approvals, reimbursement risks, clinical compliance
   - Manufacturing: supply chain, equipment lifecycle, environmental compliance
   - SaaS: MRR/ARR breakdown, CAC/LTV, net revenue retention
   - Security: certifications, zero trust readiness, compliance mandates

Do NOT duplicate items already in the base template. Add items that are SPECIFIC to this company and industry.`;

interface PromptContext {
  companyName: string;
  industry: string | null;
  businessModel: string | null;
  marketPosition: string | null;
  investmentThesis: string | null;
  strengths: string[];
  keyRisks: string[];
  rawObservations: Record<string, string> | null;
}

function getTemplateNodesSummary(): string {
  return BASE_TEMPLATE.filter((n) => n.parentId !== null)
    .map((n) => `- ${n.id}: ${n.label} (parent: ${n.parentId})`)
    .join("\n");
}

function applyContext(template: string, ctx: PromptContext): string {
  const observations = ctx.rawObservations
    ? Object.entries(ctx.rawObservations)
        .map(([k, v]) => `### ${k}\n${v}`)
        .join("\n\n")
    : "No IM data available.";

  return template
    .replace(/\{\{COMPANY_NAME\}\}/g, ctx.companyName)
    .replace(/\{\{INDUSTRY\}\}/g, ctx.industry ?? "Unknown")
    .replace(/\{\{BUSINESS_MODEL\}\}/g, ctx.businessModel ?? "Unknown")
    .replace(/\{\{MARKET_POSITION\}\}/g, ctx.marketPosition ?? "Unknown")
    .replace(/\{\{STRENGTHS\}\}/g, ctx.strengths.length > 0 ? ctx.strengths.join(", ") : "Unknown")
    .replace(/\{\{KEY_RISKS\}\}/g, ctx.keyRisks.length > 0 ? ctx.keyRisks.join(", ") : "Unknown")
    .replace(/\{\{INVESTMENT_THESIS\}\}/g, ctx.investmentThesis ?? "5年以内に経営管理料で投資回収 (Recover investment within 5 years)")
    .replace(/\{\{TEMPLATE_NODES\}\}/g, getTemplateNodesSummary())
    .replace(/\{\{RAW_OBSERVATIONS\}\}/g, observations);
}

/** Substitute placeholders with example values for preview */
export function renderTemplate(template: string): string {
  return template
    .replace(/\{\{COMPANY_NAME\}\}/g, "サンプル株式会社")
    .replace(/\{\{INDUSTRY\}\}/g, "ITセキュリティ")
    .replace(/\{\{BUSINESS_MODEL\}\}/g, "SaaS + マネージドサービス")
    .replace(/\{\{MARKET_POSITION\}\}/g, "公共・医療セクターでシェア上位")
    .replace(/\{\{STRENGTHS\}\}/g, "高い顧客リテンション, 規制対応力")
    .replace(/\{\{KEY_RISKS\}\}/g, "キーマン依存, 単一プロダクト")
    .replace(/\{\{INVESTMENT_THESIS\}\}/g, "5年以内に経営管理料で投資回収")
    .replace(/\{\{TEMPLATE_NODES\}\}/g, getTemplateNodesSummary())
    .replace(/\{\{RAW_OBSERVATIONS\}\}/g, "### clientInfo\n公共セクター顧客が売上の60%を占める...");
}

/** Build the thesis generation prompt, checking DB for active version first */
export async function buildThesisGenerationPrompt(ctx: PromptContext): Promise<string> {
  try {
    const [active] = await db
      .select({ template: promptVersions.template })
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.agentSlug, AGENT_SLUG),
          eq(promptVersions.isActive, true),
        )
      )
      .orderBy(desc(promptVersions.version))
      .limit(1);

    const template = active?.template ?? DEFAULT_TEMPLATE;
    return applyContext(template, ctx);
  } catch {
    return applyContext(DEFAULT_TEMPLATE, ctx);
  }
}
