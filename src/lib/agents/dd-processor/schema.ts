import { z } from "zod";

export const ddFindingSchema = z.object({
  templateNodeId: z
    .string()
    .describe(
      "The template_node_id of the thesis tree node this finding applies to. Must match an existing base template node ID.",
    ),
  value: z
    .string()
    .describe("The extracted finding or data point"),
  status: z
    .enum(["partial", "complete", "risk"])
    .describe(
      "'complete' if this document fully answers the node's question, 'partial' if it provides some data, 'risk' if the finding reveals a concern",
    ),
  notes: z
    .string()
    .nullable()
    .describe(
      "Additional context, caveats, or what is still missing even after this document. Null if the finding is complete.",
    ),
});

export const ddExtractionSchema = z.object({
  findings: z
    .array(ddFindingSchema)
    .describe(
      "Structured findings from the document mapped to thesis tree nodes. Only include nodes where the document provides relevant information.",
    ),
  summary: z
    .string()
    .describe("Brief overall summary of the document's key findings (2-3 sentences)"),
});

export type DDExtractionResult = z.infer<typeof ddExtractionSchema>;
