import { describe, it, expect } from "vitest";
import {
  RED_FLAG_DEFINITIONS,
  SEVERITY_CONFIG,
  CATEGORY_LABELS,
  DECISION_FRAMEWORK,
  groupBySeverity,
  groupByCategory,
  type RedFlagSeverity,
  type RedFlagCategory,
} from "./red-flags";

describe("RED_FLAG_DEFINITIONS", () => {
  it("has unique IDs", () => {
    const ids = RED_FLAG_DEFINITIONS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every flag has valid severity", () => {
    const validSeverities: RedFlagSeverity[] = ["critical", "serious", "moderate", "info_gap"];
    for (const flag of RED_FLAG_DEFINITIONS) {
      expect(validSeverities).toContain(flag.severity);
    }
  });

  it("every flag has valid category", () => {
    const validCategories: RedFlagCategory[] = [
      "financial", "clients", "legal_regulatory", "people",
      "operations", "technology", "business_model", "compliance_governance", "japan_specific",
    ];
    for (const flag of RED_FLAG_DEFINITIONS) {
      expect(validCategories).toContain(flag.category);
    }
  });

  it("every flag has a non-empty title and description", () => {
    for (const flag of RED_FLAG_DEFINITIONS) {
      expect(flag.title.length).toBeGreaterThan(0);
      expect(flag.description.length).toBeGreaterThan(0);
    }
  });

  it("has flags of all severity levels", () => {
    const severities = new Set(RED_FLAG_DEFINITIONS.map((f) => f.severity));
    expect(severities).toContain("critical");
    expect(severities).toContain("serious");
    expect(severities).toContain("moderate");
    expect(severities).toContain("info_gap");
  });

  it("has critical flags (most important for deal decisions)", () => {
    const critical = RED_FLAG_DEFINITIONS.filter((f) => f.severity === "critical");
    expect(critical.length).toBeGreaterThan(0);
  });
});

describe("SEVERITY_CONFIG", () => {
  it("covers all severity levels", () => {
    const severities: RedFlagSeverity[] = ["critical", "serious", "moderate", "info_gap"];
    for (const s of severities) {
      expect(SEVERITY_CONFIG[s]).toBeDefined();
      expect(SEVERITY_CONFIG[s].label).toBeTruthy();
      expect(SEVERITY_CONFIG[s].color).toBeTruthy();
      expect(SEVERITY_CONFIG[s].bgColor).toBeTruthy();
    }
  });
});

describe("CATEGORY_LABELS", () => {
  it("covers all category types", () => {
    const categories: RedFlagCategory[] = [
      "financial", "clients", "legal_regulatory", "people",
      "operations", "technology", "business_model", "compliance_governance", "japan_specific",
    ];
    for (const c of categories) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
    }
  });
});

describe("DECISION_FRAMEWORK", () => {
  it("has thresholds for all severity levels", () => {
    const severities: RedFlagSeverity[] = ["critical", "serious", "moderate", "info_gap"];
    for (const s of severities) {
      expect(DECISION_FRAMEWORK[s]).toBeDefined();
      expect(DECISION_FRAMEWORK[s].threshold).toBeGreaterThan(0);
      expect(DECISION_FRAMEWORK[s].action).toBeTruthy();
    }
  });
});

describe("groupBySeverity", () => {
  it("groups flags by severity", () => {
    const groups = groupBySeverity(RED_FLAG_DEFINITIONS);
    expect(groups.critical.every((f) => f.severity === "critical")).toBe(true);
    expect(groups.serious.every((f) => f.severity === "serious")).toBe(true);
    expect(groups.moderate.every((f) => f.severity === "moderate")).toBe(true);
    expect(groups.info_gap.every((f) => f.severity === "info_gap")).toBe(true);
  });

  it("total count matches original array", () => {
    const groups = groupBySeverity(RED_FLAG_DEFINITIONS);
    const total =
      groups.critical.length +
      groups.serious.length +
      groups.moderate.length +
      groups.info_gap.length;
    expect(total).toBe(RED_FLAG_DEFINITIONS.length);
  });

  it("handles empty array", () => {
    const groups = groupBySeverity([]);
    expect(groups.critical).toHaveLength(0);
    expect(groups.serious).toHaveLength(0);
    expect(groups.moderate).toHaveLength(0);
    expect(groups.info_gap).toHaveLength(0);
  });
});

describe("groupByCategory", () => {
  it("groups flags by category", () => {
    const groups = groupByCategory(RED_FLAG_DEFINITIONS);
    for (const [category, flags] of Object.entries(groups)) {
      expect(flags.every((f) => f.category === category)).toBe(true);
    }
  });

  it("total count matches original array", () => {
    const groups = groupByCategory(RED_FLAG_DEFINITIONS);
    const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(RED_FLAG_DEFINITIONS.length);
  });

  it("handles empty array", () => {
    const groups = groupByCategory([]);
    expect(Object.keys(groups)).toHaveLength(0);
  });
});
