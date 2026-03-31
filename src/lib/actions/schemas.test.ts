import { describe, it, expect } from "vitest";
import {
  createDealSchema,
  updateDealSchema,
  createTaskSchema,
  updateTaskSchema,
  addRedFlagSchema,
  createBrokerFirmSchema,
  updateBrokerFirmSchema,
  createBrokerContactSchema,
  createInteractionSchema,
  addFinancialEntrySchema,
} from "./schemas";

describe("createDealSchema", () => {
  it("accepts valid input", () => {
    const result = createDealSchema.parse({
      companyName: "Test Corp",
      stageId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.companyName).toBe("Test Corp");
  });

  it("rejects empty companyName", () => {
    expect(() =>
      createDealSchema.parse({ companyName: "", stageId: "550e8400-e29b-41d4-a716-446655440000" })
    ).toThrow();
  });

  it("rejects invalid UUID for stageId", () => {
    expect(() =>
      createDealSchema.parse({ companyName: "Test", stageId: "not-a-uuid" })
    ).toThrow();
  });

  it("rejects invalid source enum", () => {
    expect(() =>
      createDealSchema.parse({
        companyName: "Test",
        stageId: "550e8400-e29b-41d4-a716-446655440000",
        source: "invalid",
      })
    ).toThrow();
  });
});

describe("updateDealSchema", () => {
  it("accepts partial updates", () => {
    const result = updateDealSchema.parse({ companyName: "Updated" });
    expect(result.companyName).toBe("Updated");
  });

  it("rejects empty object", () => {
    expect(() => updateDealSchema.parse({})).toThrow("At least one field must be provided");
  });

  it("rejects invalid status enum", () => {
    expect(() => updateDealSchema.parse({ status: "invalid" })).toThrow();
  });
});

describe("createTaskSchema", () => {
  it("accepts valid input", () => {
    const result = createTaskSchema.parse({ title: "Review docs", category: "dd_financial" });
    expect(result.title).toBe("Review docs");
  });

  it("rejects empty title", () => {
    expect(() => createTaskSchema.parse({ title: "", category: "dd_financial" })).toThrow();
  });

  it("rejects invalid category enum", () => {
    expect(() => createTaskSchema.parse({ title: "Task", category: "invalid" })).toThrow();
  });

  it("accepts all valid categories", () => {
    const categories = [
      "sourcing", "evaluation", "dd_financial", "dd_legal", "dd_operational",
      "dd_tax", "dd_hr", "dd_it", "closing", "pmi_integration", "pmi_reporting", "other",
    ];
    for (const category of categories) {
      expect(() => createTaskSchema.parse({ title: "Task", category })).not.toThrow();
    }
  });
});

describe("updateTaskSchema", () => {
  it("accepts valid partial update", () => {
    const result = updateTaskSchema.parse({ status: "completed" });
    expect(result.status).toBe("completed");
  });

  it("rejects invalid status enum", () => {
    expect(() => updateTaskSchema.parse({ status: "invalid" })).toThrow();
  });
});

describe("addRedFlagSchema", () => {
  it("accepts valid input", () => {
    const result = addRedFlagSchema.parse({
      flagId: "crit_fin_neg_cashflow",
      severity: "critical",
      category: "financial",
    });
    expect(result.flagId).toBe("crit_fin_neg_cashflow");
  });

  it("rejects missing flagId", () => {
    expect(() =>
      addRedFlagSchema.parse({ severity: "critical", category: "financial" })
    ).toThrow();
  });

  it("rejects invalid severity", () => {
    expect(() =>
      addRedFlagSchema.parse({ flagId: "test", severity: "invalid", category: "financial" })
    ).toThrow();
  });
});

describe("createBrokerFirmSchema", () => {
  it("accepts valid input", () => {
    const result = createBrokerFirmSchema.parse({ name: "Broker Inc" });
    expect(result.name).toBe("Broker Inc");
  });

  it("rejects invalid URL for website", () => {
    expect(() =>
      createBrokerFirmSchema.parse({ name: "Broker", website: "not-a-url" })
    ).toThrow();
  });
});

describe("updateBrokerFirmSchema", () => {
  it("accepts empty partial update", () => {
    const result = updateBrokerFirmSchema.parse({});
    expect(result).toEqual({});
  });
});

describe("createBrokerContactSchema", () => {
  it("accepts valid input", () => {
    const result = createBrokerContactSchema.parse({ fullName: "John Doe" });
    expect(result.fullName).toBe("John Doe");
  });

  it("rejects invalid email", () => {
    expect(() =>
      createBrokerContactSchema.parse({ fullName: "John", email: "not-email" })
    ).toThrow();
  });
});

describe("createInteractionSchema", () => {
  it("accepts valid input", () => {
    const result = createInteractionSchema.parse({
      brokerContactId: "550e8400-e29b-41d4-a716-446655440000",
      type: "call",
      occurredAt: "2024-01-15T10:00",
    });
    expect(result.type).toBe("call");
  });

  it("rejects invalid type enum", () => {
    expect(() =>
      createInteractionSchema.parse({
        brokerContactId: "550e8400-e29b-41d4-a716-446655440000",
        type: "invalid",
        occurredAt: "2024-01-15",
      })
    ).toThrow();
  });

  it("rejects missing occurredAt", () => {
    expect(() =>
      createInteractionSchema.parse({
        brokerContactId: "550e8400-e29b-41d4-a716-446655440000",
        type: "call",
      })
    ).toThrow();
  });
});

describe("addFinancialEntrySchema", () => {
  it("accepts valid input", () => {
    const result = addFinancialEntrySchema.parse({
      period: "2024-Q1",
      periodType: "quarterly",
    });
    expect(result.period).toBe("2024-Q1");
  });

  it("rejects invalid periodType", () => {
    expect(() =>
      addFinancialEntrySchema.parse({ period: "2024-Q1", periodType: "invalid" })
    ).toThrow();
  });

  it("rejects empty period", () => {
    expect(() =>
      addFinancialEntrySchema.parse({ period: "", periodType: "quarterly" })
    ).toThrow();
  });
});
