import { z } from "zod";

export const thesisNodeSchema = z.object({
  parentTemplateNodeId: z
    .string()
    .describe(
      "The template_node_id of the parent node to attach this child under. Must be one of the existing base template node IDs.",
    ),
  label: z.string().describe("Short label for this diligence item (English)"),
  description: z
    .string()
    .describe("One-line explanation of what this node evaluates"),
  suggestedStatus: z
    .enum(["unknown", "partial", "complete", "risk"])
    .describe(
      "Based on available IM data: 'complete' if the IM provides clear data, 'partial' if some info exists, 'risk' if data shows a concern, 'unknown' if no data available",
    ),
  suggestedValue: z
    .string()
    .nullable()
    .describe("Pre-filled value from the IM analysis if available, null otherwise"),
  suggestedNotes: z
    .string()
    .nullable()
    .describe(
      "For partial/unknown nodes: explain what specific information is still missing and needs to be investigated. For risk nodes: describe the concern. Null only for complete nodes.",
    ),
  sortOrder: z.number().describe("Order within siblings (0-indexed)"),
});

export const thesisGenerationSchema = z.object({
  nodes: z
    .array(thesisNodeSchema)
    .describe(
      "Industry-specific diligence nodes to add to the thesis tree. These extend the base template with branches relevant to this specific company's industry, business model, and market.",
    ),
});

export type ThesisGenerationResult = z.infer<typeof thesisGenerationSchema>;
