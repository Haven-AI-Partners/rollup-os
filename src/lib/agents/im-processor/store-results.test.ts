import { describe, it, expect } from "vitest";
import { parseNumericValue } from "./store-results";

describe("parseNumericValue", () => {
  it("parses plain numbers", () => {
    expect(parseNumericValue("250000000")).toBe("250000000");
  });

  it("strips commas", () => {
    expect(parseNumericValue("250,000,000")).toBe("250000000");
  });

  it("strips yen symbol", () => {
    expect(parseNumericValue("¥250000000")).toBe("250000000");
  });

  it("strips dollar symbol", () => {
    expect(parseNumericValue("$2500000")).toBe("2500000");
  });

  it("strips euro symbol", () => {
    expect(parseNumericValue("€1500000")).toBe("1500000");
  });

  it("strips spaces", () => {
    expect(parseNumericValue("250 000 000")).toBe("250000000");
  });

  it("handles decimal numbers", () => {
    expect(parseNumericValue("3.5")).toBe("3.5");
  });

  it("handles negative numbers", () => {
    expect(parseNumericValue("-50000000")).toBe("-50000000");
  });

  it("returns null for null input", () => {
    expect(parseNumericValue(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseNumericValue(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseNumericValue("")).toBeNull();
  });

  it("returns null for non-numeric text", () => {
    expect(parseNumericValue("about 250M")).toBeNull();
  });

  it("returns null for text with units", () => {
    expect(parseNumericValue("250M")).toBeNull();
  });
});
