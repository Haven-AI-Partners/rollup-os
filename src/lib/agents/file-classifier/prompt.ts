import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const AGENT_SLUG = "file-classifier";

const FILE_TYPE_DESCRIPTIONS = `
- im_pdf: Information Memorandum — the primary deal document with company overview, financials, team. Often named IM, 企業概要, 案件概要, company profile, investment summary.
- dd_financial: Financial due diligence documents — audited financials, P&L, balance sheet, cash flow statements, tax returns, financial models.
- dd_legal: Legal due diligence — litigation summaries, contract reviews, IP registrations, regulatory filings, compliance audits.
- dd_operational: Operational due diligence — facility assessments, supply chain analysis, process documentation, environmental reports.
- dd_tax: Tax due diligence — tax structure analysis, transfer pricing, hidden liabilities, tax incentive assessments.
- dd_hr: HR/People due diligence — headcount reports, compensation analysis, org charts, turnover data, labor compliance, succession plans.
- dd_it: IT/Technology due diligence — tech stack assessments, security audits (SOC2, ISO), cloud architecture, code quality, data governance.
- nda: Non-disclosure agreement or confidentiality agreement.
- loi: Letter of Intent or Indication of Interest.
- purchase_agreement: Share Purchase Agreement (SPA), Asset Purchase Agreement, definitive agreements.
- pmi_plan: Post-Merger Integration plan.
- pmi_report: Post-Merger Integration progress report.
- report: General reports, presentations, memos that don't fit other categories.
- attachment: Supporting attachments, appendices, exhibits.
- other: Files that don't fit any category above.
`;

export const DEFAULT_TEMPLATE = `You are a document classifier for M&A deal flow management. Your task is to classify files found in a Google Drive folder structure.

You will receive:
- The file name
- The file's MIME type
- The folder path (breadcrumb trail from the root folder)

Based on these signals, determine what type of document this is.

## File Type Definitions
{{FILE_TYPES}}

## Classification Guidelines
- **Folder path is the strongest signal.** A file in a folder named "DD" or "Financial" or "法務" (legal) strongly indicates the document type.
- **Filename patterns matter.** Look for keywords in both English and Japanese.
- **MIME type helps filter.** PDFs and spreadsheets are more likely to be substantive documents. Images and presentations may be attachments.
- **When unsure, prefer "other" over a wrong classification.** A low-confidence "other" is better than a high-confidence wrong type.
- **Company name inference:** Look at the folder structure — often the company name is a parent folder (e.g., "Root/CompanyName/DD/Financial/report.pdf" → company is "CompanyName").

## Japanese Folder/File Name Patterns
- 企業概要, 案件概要, IM → im_pdf
- 財務, 決算, 会計, BS, PL → dd_financial
- 法務, 契約, 訴訟, コンプライアンス → dd_legal
- 人事, 組織, 給与, 労務 → dd_hr
- IT, システム, 技術, セキュリティ → dd_it
- 事業, オペレーション, 業務 → dd_operational
- 税務, 税金 → dd_tax
- NDA, 秘密保持 → nda
- LOI, 意向表明 → loi
- SPA, 株式譲渡, 事業譲渡 → purchase_agreement
- PMI, 統合計画 → pmi_plan or pmi_report

Classify the file based on the information provided.`;

export function renderTemplate(template: string): string {
  return template.replace("{{FILE_TYPES}}", FILE_TYPE_DESCRIPTIONS);
}

async function loadPromptFromDb(fallback: string): Promise<string> {
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

    if (active) return renderTemplate(active.template);
  } catch {
    // DB not available — use default
  }
  return renderTemplate(fallback);
}

export async function buildClassificationPrompt(): Promise<string> {
  return loadPromptFromDb(DEFAULT_TEMPLATE);
}
