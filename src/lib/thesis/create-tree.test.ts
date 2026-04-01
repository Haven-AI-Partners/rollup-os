import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──

const {
  mockSelect,
  mockInsert,
  mockFrom,
  mockWhere,
  mockLimit,
  mockValues,
  mockFormatCurrency,
  mockGetBaseTemplate,
  mockGenerateIndustryNodes,
  mockInsertGeneratedNodes,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockValues: vi.fn(),
  mockFormatCurrency: vi.fn((v: string) => `$${v}`),
  mockGetBaseTemplate: vi.fn(),
  mockGenerateIndustryNodes: vi.fn(),
  mockInsertGeneratedNodes: vi.fn(),
}));

vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("mock-uuid") });

// ── Module mocks ──

vi.mock("@/lib/db", () => {
  const chain = () => ({
    select: mockSelect,
    insert: mockInsert,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    values: mockValues,
  });
  for (const fn of [mockSelect, mockInsert, mockFrom, mockWhere, mockValues]) {
    fn.mockReturnValue(chain());
  }
  // limit is terminal — don't set a default; we configure per-test
  mockLimit.mockReturnValue(chain());
  return { db: chain() };
});

vi.mock("@/lib/db/schema", () => ({
  dealThesisNodes: {
    id: "id",
    dealId: "dealId",
    portcoId: "portcoId",
    parentId: "parentId",
    label: "label",
    description: "description",
    status: "status",
    value: "value",
    notes: "notes",
    source: "source",
    sortOrder: "sortOrder",
    templateNodeId: "templateNodeId",
  },
  companyProfiles: {
    id: "id",
    dealId: "dealId",
    rawExtraction: "rawExtraction",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

vi.mock("@/lib/format", () => ({
  formatCurrency: mockFormatCurrency,
}));

vi.mock("@/lib/thesis/template", () => ({
  getBaseTemplate: mockGetBaseTemplate,
}));

vi.mock("@/lib/agents/im-processor/schema", () => ({}));

vi.mock("@/lib/agents/thesis-generator", () => ({
  generateIndustryNodes: mockGenerateIndustryNodes,
  insertGeneratedNodes: mockInsertGeneratedNodes,
}));

// ── Import under test (after mocks) ──

import { createThesisTreeForDeal } from "./create-tree";

// ── Helpers ──

const SMALL_TEMPLATE = [
  { id: "root", parentId: null, label: "Root", description: "Root node", sortOrder: 0 },
  { id: "child1", parentId: "root", label: "Child", description: "Child node", sortOrder: 1 },
];

function setupDbChain(existingRows: unknown[], profileRows: unknown[]) {
  // First chain: select → from → where → limit (existing check)
  // Second chain: select → from → where → limit (profile load)
  let limitCallCount = 0;
  mockLimit.mockImplementation(() => {
    limitCallCount++;
    if (limitCallCount === 1) return Promise.resolve(existingRows);
    if (limitCallCount === 2) return Promise.resolve(profileRows);
    return Promise.resolve([]);
  });
}

// ── Tests ──

describe("createThesisTreeForDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBaseTemplate.mockReturnValue(SMALL_TEMPLATE);
  });

  it("returns 0 and skips creation when thesis already exists", async () => {
    setupDbChain([{ id: "existing-id" }], []);

    const count = await createThesisTreeForDeal("deal-001", "portco-001");

    expect(count).toBe(0);
    // insert should never have been called
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates tree and returns insert count when no thesis exists", async () => {
    setupDbChain([], []);

    const count = await createThesisTreeForDeal("deal-001", "portco-001");

    expect(count).toBe(SMALL_TEMPLATE.length);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalled();

    // Verify inserts contain expected fields
    const insertedValues = mockValues.mock.calls[mockValues.mock.calls.length - 1][0];
    expect(insertedValues).toHaveLength(SMALL_TEMPLATE.length);
    expect(insertedValues[0]).toMatchObject({
      dealId: "deal-001",
      portcoId: "portco-001",
      label: "Root",
      templateNodeId: "root",
    });
  });

  it("creates tree with pre-fill data when extraction exists", async () => {
    const extraction = {
      companyProfile: {
        companyName: "TestCo",
        summary: "summary",
        businessModel: "model",
        marketPosition: "Leader",
        industryTrends: "Growing",
        strengths: [],
        keyRisks: [],
        location: null,
        industry: null,
        askingPrice: null,
      },
      financialHighlights: {
        revenue: "100000000",
        ebitda: "20000000",
        currency: "JPY",
        revenueGrowth: "10%",
        operatingMargin: null,
        ebitdaMargin: "20%",
        recurringRevenue: "80%",
        employeeCount: 50,
        fullTimeCount: 40,
        contractorCount: 10,
        topClientConcentration: "30%",
        debtLevel: "1.5x",
      },
      managementTeam: [
        { name: "Taro Yamada", title: "代表取締役社長", department: null, role: "executive" as const, reportsTo: null },
      ],
      scoring: {
        financial_stability: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        debt_leverage: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        org_complexity: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        technology: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        client_concentration: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        ai_readiness: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        business_model: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        integration_risk: { score: 3, rationale: "", evidence: "", dataAvailable: true },
      },
      redFlags: [],
      infoGaps: [],
    };

    setupDbChain([], [{ rawExtraction: extraction }]);
    mockGenerateIndustryNodes.mockResolvedValue({ nodes: [] });
    mockInsertGeneratedNodes.mockResolvedValue(3);

    const count = await createThesisTreeForDeal("deal-001", "portco-001");

    // base inserts + AI count
    expect(count).toBe(SMALL_TEMPLATE.length + 3);
    expect(mockGenerateIndustryNodes).toHaveBeenCalledWith({
      dealId: "deal-001",
      portcoId: "portco-001",
    });
    expect(mockInsertGeneratedNodes).toHaveBeenCalled();
  });

  it("handles AI enhancement failure gracefully and returns base count", async () => {
    const extraction = {
      companyProfile: {
        companyName: "TestCo",
        summary: "summary",
        businessModel: "model",
        marketPosition: "Leader",
        industryTrends: "Growing",
        strengths: [],
        keyRisks: [],
        location: null,
        industry: null,
        askingPrice: null,
      },
      financialHighlights: {
        revenue: "100000000",
        ebitda: null,
        currency: "JPY",
        revenueGrowth: null,
        operatingMargin: null,
        ebitdaMargin: null,
        recurringRevenue: null,
        employeeCount: null,
        fullTimeCount: null,
        contractorCount: null,
        topClientConcentration: null,
        debtLevel: null,
      },
      managementTeam: [],
      scoring: {
        financial_stability: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        debt_leverage: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        org_complexity: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        technology: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        client_concentration: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        ai_readiness: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        business_model: { score: 3, rationale: "", evidence: "", dataAvailable: true },
        integration_risk: { score: 3, rationale: "", evidence: "", dataAvailable: true },
      },
      redFlags: [],
      infoGaps: [],
    };

    setupDbChain([], [{ rawExtraction: extraction }]);
    mockGenerateIndustryNodes.mockRejectedValue(new Error("AI service unavailable"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const count = await createThesisTreeForDeal("deal-001", "portco-001");

    // Only base inserts, no AI nodes
    expect(count).toBe(SMALL_TEMPLATE.length);
    expect(consoleSpy).toHaveBeenCalledWith(
      "AI enhancement failed (base tree still created):",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("does not call AI enhancement when no extraction exists", async () => {
    setupDbChain([], []);

    await createThesisTreeForDeal("deal-001", "portco-001");

    expect(mockGenerateIndustryNodes).not.toHaveBeenCalled();
    expect(mockInsertGeneratedNodes).not.toHaveBeenCalled();
  });
});
