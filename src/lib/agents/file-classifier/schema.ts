import { z } from "zod";

export const FILE_TYPE_VALUES = [
  "im_pdf",
  "report",
  "attachment",
  "nda",
  "dd_financial",
  "dd_legal",
  "dd_operational",
  "dd_tax",
  "dd_hr",
  "dd_it",
  "loi",
  "purchase_agreement",
  "pmi_plan",
  "pmi_report",
  "excel_data",
  "other",
] as const;

export const classificationSchema = z.object({
  fileType: z.enum(FILE_TYPE_VALUES).describe(
    "The classified document type based on filename, folder path, and context",
  ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Classification confidence from 0 to 1"),
  suggestedCompanyName: z
    .string()
    .nullable()
    .describe(
      "Company name inferred from the document content, folder structure, or filename. Null if unclear.",
    ),
  reasoning: z
    .string()
    .describe("Brief explanation of why this classification was chosen"),
});

export type ClassificationResult = z.infer<typeof classificationSchema>;

/** Extended result that includes which tier performed the classification */
export interface HybridClassificationResult extends ClassificationResult {
  tier: "rules" | "vision";
}
