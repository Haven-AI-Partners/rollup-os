import { describe, it, expect } from "vitest";
import { calculateAutomationScore, parseTimeToMinutes } from "./automation-score";

describe("calculateAutomationScore", () => {
  it("returns 0 for all-null input (except businessImpact defaults to medium = 5)", () => {
    const score = calculateAutomationScore({
      ruleBasedNature: null,
      standardizationLevel: null,
      timeSpentMinutes: null,
      frequency: null,
      volume: null,
      riskLevel: null,
      businessImpact: null,
    });
    // businessImpact defaults to "medium" = 5 points
    expect(score).toBe(5);
  });

  it("returns max score for optimal input", () => {
    const score = calculateAutomationScore({
      ruleBasedNature: 100,     // 25 points
      standardizationLevel: "high", // 15 points
      timeSpentMinutes: 150,    // 20 points
      frequency: "daily",       // 10 points
      volume: "high",           // 5 points
      riskLevel: "low",         // 15 points
      businessImpact: "high",   // 10 points
    });
    expect(score).toBe(100);
  });

  it("clamps score to 0-100 range", () => {
    const score = calculateAutomationScore({
      ruleBasedNature: 100,
      standardizationLevel: "high",
      timeSpentMinutes: 200,
      frequency: "daily",
      volume: "high",
      riskLevel: "low",
      businessImpact: "high",
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("calculates individual components correctly", () => {
    // Only ruleBasedNature = 50 → 13 points + default businessImpact 5
    expect(calculateAutomationScore({
      ruleBasedNature: 50,
      standardizationLevel: null,
      timeSpentMinutes: null,
      frequency: null,
      volume: null,
      riskLevel: null,
      businessImpact: null,
    })).toBe(18); // round(50/100 * 25) = 13 + 5

    // Only timeSpentMinutes
    expect(calculateAutomationScore({
      ruleBasedNature: null,
      standardizationLevel: null,
      timeSpentMinutes: 5,
      frequency: null,
      volume: null,
      riskLevel: null,
      businessImpact: "low",
    })).toBe(0); // <10 min = 0, low impact = 0

    expect(calculateAutomationScore({
      ruleBasedNature: null,
      standardizationLevel: null,
      timeSpentMinutes: 30,
      frequency: null,
      volume: null,
      riskLevel: null,
      businessImpact: "low",
    })).toBe(5); // 10-30 min = 5, low impact = 0

    expect(calculateAutomationScore({
      ruleBasedNature: null,
      standardizationLevel: null,
      timeSpentMinutes: 60,
      frequency: null,
      volume: null,
      riskLevel: null,
      businessImpact: "low",
    })).toBe(10); // 31-60 min = 10

    expect(calculateAutomationScore({
      ruleBasedNature: null,
      standardizationLevel: null,
      timeSpentMinutes: 120,
      frequency: null,
      volume: null,
      riskLevel: null,
      businessImpact: "low",
    })).toBe(15); // 61-120 min = 15
  });

  it("handles unknown enum values gracefully", () => {
    const score = calculateAutomationScore({
      ruleBasedNature: null,
      standardizationLevel: "unknown",
      timeSpentMinutes: null,
      frequency: "never",
      volume: "extreme",
      riskLevel: "catastrophic",
      businessImpact: "unknown",
    });
    // All unknowns → 0 except businessImpact fallback
    expect(score).toBe(5);
  });
});

describe("parseTimeToMinutes", () => {
  it("returns null for null or empty input", () => {
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes("")).toBeNull();
  });

  it("parses English minute patterns", () => {
    expect(parseTimeToMinutes("30 minutes")).toBe(30);
    expect(parseTimeToMinutes("15 mins")).toBe(15);
    expect(parseTimeToMinutes("5m")).toBe(5);
    expect(parseTimeToMinutes("1.5 minutes")).toBe(2);
  });

  it("parses English hour patterns", () => {
    expect(parseTimeToMinutes("2 hours")).toBe(120);
    expect(parseTimeToMinutes("1.5h")).toBe(90);
    expect(parseTimeToMinutes("1 hr")).toBe(60);
  });

  it("parses combined hour and minute patterns", () => {
    expect(parseTimeToMinutes("2 hours 30 minutes")).toBe(150);
    expect(parseTimeToMinutes("1h30m")).toBe(90);
    expect(parseTimeToMinutes("1 hour and 15 mins")).toBe(75);
  });

  it("parses Japanese patterns", () => {
    expect(parseTimeToMinutes("30分")).toBe(30);
    expect(parseTimeToMinutes("2時間")).toBe(120);
    expect(parseTimeToMinutes("1時間30分")).toBe(90);
    expect(parseTimeToMinutes("1.5時間")).toBe(90);
  });

  it("parses range patterns", () => {
    // "10-30 minutes" matches the minOnly pattern first (capturing "30 minutes")
    expect(parseTimeToMinutes("10-30 minutes")).toBe(30);
    // "1-2 hours" matches the hourMin pattern first (capturing "2 hours")
    expect(parseTimeToMinutes("1-2 hours")).toBe(120);
  });

  it("parses plain numbers as minutes", () => {
    expect(parseTimeToMinutes("30")).toBe(30);
    expect(parseTimeToMinutes("120")).toBe(120);
  });

  it("returns null for unrecognized patterns", () => {
    expect(parseTimeToMinutes("a long time")).toBeNull();
    expect(parseTimeToMinutes("forever")).toBeNull();
  });
});
