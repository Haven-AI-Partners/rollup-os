import { describe, it, expect } from "vitest";
import { formatCurrency, formatDateTime, formatDateShort, formatDuration } from "./format";

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

describe("formatDateTime", () => {
  it("formats a date string with month, day, and time", () => {
    const result = formatDateTime("2024-03-15T14:30:00Z");
    expect(result).toContain("Mar");
    expect(result).toContain("15");
  });

  it("formats a Date object", () => {
    const result = formatDateTime(new Date("2024-06-01T10:00:00Z"));
    expect(result).toContain("Jun");
  });
});

describe("formatDateShort", () => {
  it("formats with month and day only", () => {
    const result = formatDateShort("2024-12-25T00:00:00Z");
    expect(result).toContain("Dec");
    expect(result).toContain("25");
  });

  it("works with Date objects", () => {
    const result = formatDateShort(new Date("2024-01-15"));
    expect(result).toContain("Jan");
  });
});

describe("formatDuration", () => {
  it("formats seconds under a minute", () => {
    expect(formatDuration(45000)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(150000)).toBe("2m 30s");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("rounds to nearest second", () => {
    expect(formatDuration(1500)).toBe("2s");
  });

  it("handles exact minute boundary", () => {
    expect(formatDuration(60000)).toBe("1m 0s");
  });
});
