import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatCurrency,
  formatDateTime,
  formatDateShort,
  formatDateWithYear,
  formatDuration,
  formatRelativeDate,
  formatRelativeTime,
} from "./format";

describe("formatCurrency", () => {
  it("formats JPY by default", () => {
    expect(formatCurrency(1000000)).toBe("¥100万");
  });

  it("formats JPY explicitly", () => {
    expect(formatCurrency(250000000, "JPY")).toBe("¥2.5億");
  });

  it("formats JPY with 億 for exact oku", () => {
    expect(formatCurrency(100000000, "JPY")).toBe("¥1億");
  });

  it("formats JPY small values without units", () => {
    expect(formatCurrency(5000, "JPY")).toBe("¥5,000");
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
    expect(formatCurrency("5000000", "JPY")).toBe("¥500万");
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

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent timestamps", () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
  });

  it("formats minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("formats hours ago", () => {
    const twoHrsAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHrsAgo)).toBe("2h ago");
  });

  it("formats days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
  });

  it("formats weeks ago", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoWeeksAgo)).toBe("2w ago");
  });

  it("formats months ago", () => {
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeMonthsAgo)).toBe("3mo ago");
  });

  it("formats years ago", () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoYearsAgo)).toBe("2y ago");
  });

  it("accepts string dates", () => {
    const twoHrsAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHrsAgo)).toBe("2h ago");
  });
});

describe("formatBytes", () => {
  it("returns null for null input", () => {
    expect(formatBytes(null)).toBeNull();
  });

  it("returns null for zero", () => {
    expect(formatBytes(0)).toBeNull();
  });

  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(2621440)).toBe("2.5 MB");
  });

  it("accepts string input", () => {
    expect(formatBytes("1024")).toBe("1.0 KB");
  });

  it("returns null for NaN string", () => {
    expect(formatBytes("not a number")).toBeNull();
  });
});

describe("formatDateWithYear", () => {
  it("formats with month, day, and year", () => {
    const result = formatDateWithYear("2024-03-15T00:00:00Z");
    expect(result).toContain("Mar");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  it("accepts Date objects", () => {
    const result = formatDateWithYear(new Date("2024-12-25"));
    expect(result).toContain("Dec");
    expect(result).toContain("2024");
  });
});

describe("formatRelativeDate", () => {
  it("returns 'Never' for null", () => {
    expect(formatRelativeDate(null)).toBe("Never");
  });

  it("returns 'Today' for today", () => {
    expect(formatRelativeDate(new Date())).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday", () => {
    const yesterday = new Date(Date.now() - 86400000);
    expect(formatRelativeDate(yesterday)).toBe("Yesterday");
  });

  it("delegates to formatRelativeTime for older dates", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
    expect(formatRelativeDate(tenDaysAgo)).toBe("1w ago");
  });
});
