import { z } from "zod";

// ── Source attribution for IM-derived data ──
// Field descriptions are intentionally omitted to keep JSON Schemas
// small enough for Gemini's constrained decoding state limit.

export const imSourceRefSchema = z.object({
  type: z.literal("im_document"),
  pageNumbers: z.array(z.number()),
  quote: z.string(),
});

export type IMSourceRef = z.infer<typeof imSourceRefSchema>;

// ── Source attribution for externally-sourced data ──

export const externalSourceRefSchema = z.object({
  type: z.literal("external"),
  url: z.string(),
  sourceName: z.string(),
  retrievedAt: z.string(),
});

export type ExternalSourceRef = z.infer<typeof externalSourceRefSchema>;

// ── Union type for any sourced data ──

export const sourceRefSchema = z.discriminatedUnion("type", [
  imSourceRefSchema,
  externalSourceRefSchema,
]);

export type SourceRef = z.infer<typeof sourceRefSchema>;
