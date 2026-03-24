import { describe, it, expect } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formats JPY by default", () => {
    expect(formatCurrency(1000000)).toBe("¥1,000,000");
  });

  it("formats JPY explicitly", () => {
    expect(formatCurrency(250000000, "JPY")).toBe("¥250,000,000");
  });

  it("formats USD", () => {
    expect(formatCurrency(1000000, "USD")).toBe("$1,000,000");
  });

  it("formats EUR", () => {
    const result = formatCurrency(1000000, "EUR");
    expect(result).toContain("1,000,000");
  });

  it("returns dash for null", () => {
    expect(formatCurrency(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatCurrency(undefined as any)).toBe("—");
  });

  it("returns dash for NaN string", () => {
    expect(formatCurrency("not a number")).toBe("—");
  });

  it("parses string numbers", () => {
    expect(formatCurrency("5000000", "JPY")).toBe("¥5,000,000");
  });

  it("handles zero", () => {
    expect(formatCurrency(0, "JPY")).toBe("¥0");
  });

  it("falls back for invalid currency code", () => {
    const result = formatCurrency(1000, "INVALID");
    expect(result).toContain("INVALID");
    expect(result).toContain("1,000");
  });
});
