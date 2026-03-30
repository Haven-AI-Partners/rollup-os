import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { classificationSchema, type ClassificationResult } from "./schema";
import { downloadFile } from "@/lib/gdrive/client";
import { renderPdfPagesToImages } from "./pdf-renderer";
import { MODEL_ID } from "./constants";

const MAX_PAGES = 3;

const VISION_SYSTEM_PROMPT = `You are a document classifier for M&A deal flow management. You are given the first pages of a PDF document along with its metadata.

Your task is to:
1. Classify the document type
2. Extract the company name if visible in the document

## File Type Definitions
- im_pdf: Information Memorandum — the primary deal document with company overview, financials, team.
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

## Classification Guidelines
- Look at the document content, headers, titles, and structure to determine the type.
- Extract the company name from the document if visible (cover page, headers, title, etc.).
- For Japanese documents, look for company names in the format: 株式会社XX, XX株式会社, (株)XX, XX(株).
- When unsure, prefer "other" over a wrong classification.
- Set confidence based on how clear the signals are in the document content.`;

interface VisionClassifyInput {
  fileName: string;
  mimeType: string;
  parentPath: string;
  portcoId: string;
  gdriveFileId: string;
}

/**
 * Classify a file by downloading it and sending page images to Gemini vision.
 * Falls back to metadata-only classification if download fails.
 */
export async function classifyWithVision(
  input: VisionClassifyInput,
): Promise<ClassificationResult> {
  const { fileName, mimeType, parentPath, portcoId, gdriveFileId } = input;

  // Try to download and render PDF pages
  let pageImages: { base64: string; mimeType: string }[] = [];
  try {
    const buffer = await downloadFile(portcoId, gdriveFileId);
    if (buffer) {
      pageImages = await renderPdfPagesToImages(buffer, MAX_PAGES);
    }
  } catch {
    // Download or render failed — proceed with metadata only
  }

  const userContent: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType: string }> = [
    {
      type: "text" as const,
      text: `Classify this file:
- File name: ${fileName}
- MIME type: ${mimeType}
- Folder path: ${parentPath || "(root folder)"}
${pageImages.length > 0 ? `\nThe first ${pageImages.length} page(s) of the document are attached below.` : "\nNo document pages available — classify based on metadata only."}`,
    },
  ];

  // Attach page images
  for (const page of pageImages) {
    userContent.push({
      type: "image" as const,
      image: page.base64,
      mimeType: page.mimeType,
    });
  }

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: classificationSchema,
    system: VISION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    temperature: 0,
  });

  return object;
}
