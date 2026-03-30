import { z } from "zod";

// ── Source attribution for IM-derived data ──

export const imSourceRefSchema = z.object({
  type: z.literal("im_document"),
  pageNumbers: z.array(z.number()).describe("Page numbers in the original PDF where this data was found"),
  quote: z.string().describe("Direct quote or close paraphrase from the IM supporting this data"),
});

export type IMSourceRef = z.infer<typeof imSourceRefSchema>;

// ── Source attribution for externally-sourced data ──

export const externalSourceRefSchema = z.object({
  type: z.literal("external"),
  url: z.string().describe("URL of the external source"),
  sourceName: z.string().describe("Name of the source (e.g. 'Google Search', 'Company Website')"),
  retrievedAt: z.string().describe("ISO 8601 timestamp when the data was retrieved"),
});

export type ExternalSourceRef = z.infer<typeof externalSourceRefSchema>;

// ── Union type for any sourced data ──

export const sourceRefSchema = z.discriminatedUnion("type", [
  imSourceRefSchema,
  externalSourceRefSchema,
]);

export type SourceRef = z.infer<typeof sourceRefSchema>;
