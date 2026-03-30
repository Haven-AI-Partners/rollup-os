import { describe, it, expect } from "vitest";
import { imSourceRefSchema, externalSourceRefSchema, sourceRefSchema } from "./source-attribution";

describe("imSourceRefSchema", () => {
  it("validates correct IM source reference", () => {
    const result = imSourceRefSchema.safeParse({
      type: "im_document",
      pageNumbers: [1, 2],
      quote: "Revenue of ¥250M in FY2024",
    });
    expect(result.success).toBe(true);
  });

  it("requires type to be im_document", () => {
    const result = imSourceRefSchema.safeParse({
      type: "external",
      pageNumbers: [1],
      quote: "test",
    });
    expect(result.success).toBe(false);
  });

  it("allows empty pageNumbers array", () => {
    const result = imSourceRefSchema.safeParse({
      type: "im_document",
      pageNumbers: [],
      quote: "Not mentioned in the IM",
    });
    expect(result.success).toBe(true);
  });
});

describe("externalSourceRefSchema", () => {
  it("validates correct external source reference", () => {
    const result = externalSourceRefSchema.safeParse({
      type: "external",
      url: "https://example.com/article",
      sourceName: "Company Website",
      retrievedAt: "2026-03-30T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("requires type to be external", () => {
    const result = externalSourceRefSchema.safeParse({
      type: "im_document",
      url: "https://example.com",
      sourceName: "test",
      retrievedAt: "2026-03-30T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("sourceRefSchema (discriminated union)", () => {
  it("accepts IM source ref", () => {
    const result = sourceRefSchema.safeParse({
      type: "im_document",
      pageNumbers: [3],
      quote: "Company was founded in 2005",
    });
    expect(result.success).toBe(true);
  });

  it("accepts external source ref", () => {
    const result = sourceRefSchema.safeParse({
      type: "external",
      url: "https://example.com",
      sourceName: "Google Search",
      retrievedAt: "2026-03-30T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown type", () => {
    const result = sourceRefSchema.safeParse({
      type: "unknown",
      pageNumbers: [1],
      quote: "test",
    });
    expect(result.success).toBe(false);
  });
});
