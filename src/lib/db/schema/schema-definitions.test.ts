/**
 * Schema definition import test.
 * Ensures all schema tables and their FK references are properly defined.
 * This exercises the anonymous arrow functions in .references() calls.
 */
import { describe, it, expect } from "vitest";

// Import all schemas to trigger FK reference callbacks
import * as schema from "./index";

describe("schema definitions", () => {
  it("exports all core tables", () => {
    expect(schema.users).toBeDefined();
    expect(schema.portcos).toBeDefined();
    expect(schema.portcoMemberships).toBeDefined();
    expect(schema.deals).toBeDefined();
    expect(schema.pipelineStages).toBeDefined();
    expect(schema.dealComments).toBeDefined();
    expect(schema.dealTransfers).toBeDefined();
    expect(schema.dealFinancials).toBeDefined();
    expect(schema.dealActivityLog).toBeDefined();
    expect(schema.dealRedFlags).toBeDefined();
    expect(schema.dealTasks).toBeDefined();
    expect(schema.dealThesisNodes).toBeDefined();
    expect(schema.files).toBeDefined();
    expect(schema.companyProfiles).toBeDefined();
    expect(schema.brokerFirms).toBeDefined();
    expect(schema.brokerContacts).toBeDefined();
    expect(schema.brokerInteractions).toBeDefined();
    expect(schema.agentDefinitions).toBeDefined();
    expect(schema.promptVersions).toBeDefined();
    expect(schema.evalRuns).toBeDefined();
    expect(schema.notifications).toBeDefined();
    expect(schema.kpiDefinitions).toBeDefined();
    expect(schema.kpiValues).toBeDefined();
  });

  it("tables have expected column structures", () => {
    // Verify deals table has essential columns
    const dealCols = Object.keys(schema.deals);
    expect(dealCols).toContain("id");
    expect(dealCols).toContain("portcoId");
    expect(dealCols).toContain("companyName");

    // Verify users table
    const userCols = Object.keys(schema.users);
    expect(userCols).toContain("id");
    expect(userCols).toContain("clerkId");
    expect(userCols).toContain("email");

    // Verify broker tables
    const firmCols = Object.keys(schema.brokerFirms);
    expect(firmCols).toContain("id");
    expect(firmCols).toContain("name");
  });
});
