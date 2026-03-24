/**
 * Test data factories for creating consistent mock objects.
 */

let counter = 0;
function nextId(prefix = "id") {
  return `${prefix}-${++counter}`;
}

export function resetFactoryCounter() {
  counter = 0;
}

export function buildUser(overrides: Record<string, unknown> = {}) {
  const id = nextId("user");
  return {
    id,
    clerkId: nextId("clerk"),
    email: `${id}@example.com`,
    fullName: `User ${id}`,
    avatarUrl: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildPortco(overrides: Record<string, unknown> = {}) {
  const id = nextId("portco");
  return {
    id,
    name: `PortCo ${id}`,
    slug: `portco-${id}`,
    gdriveFolderId: null,
    gdriveServiceAccountEnc: null,
    scoringRubric: null,
    acquisitionCriteria: null,
    investmentThesis: null,
    targets: null,
    slackWebhookUrl: null,
    slackChannelId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildDeal(overrides: Record<string, unknown> = {}) {
  const id = nextId("deal");
  return {
    id,
    portcoId: "portco-001",
    stageId: "stage-001",
    companyName: `Company ${id}`,
    description: null,
    industry: null,
    location: null,
    askingPrice: null,
    revenue: null,
    ebitda: null,
    currency: "JPY",
    status: "active" as const,
    source: "manual" as const,
    assignedTo: null,
    kanbanPosition: 0,
    employeeCount: null,
    closedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildBrokerFirm(overrides: Record<string, unknown> = {}) {
  const id = nextId("firm");
  return {
    id,
    name: `Broker Firm ${id}`,
    website: null,
    region: null,
    specialty: null,
    listingUrl: null,
    metadata: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildPipelineStage(overrides: Record<string, unknown> = {}) {
  const id = nextId("stage");
  return {
    id,
    portcoId: "portco-001",
    name: `Stage ${id}`,
    slug: `stage-${id}`,
    phase: "sourcing" as const,
    position: 0,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildRedFlag(overrides: Record<string, unknown> = {}) {
  const id = nextId("flag");
  return {
    id,
    dealId: "deal-001",
    portcoId: "portco-001",
    flagId: "crit_fin_neg_cashflow",
    severity: "critical" as const,
    category: "financial",
    notes: null,
    flaggedBy: "user-001",
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildTask(overrides: Record<string, unknown> = {}) {
  const id = nextId("task");
  return {
    id,
    dealId: "deal-001",
    portcoId: "portco-001",
    title: `Task ${id}`,
    description: null,
    category: "sourcing",
    status: "pending",
    priority: "medium",
    assignedTo: null,
    dueDate: null,
    parentTaskId: null,
    position: 0,
    completedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildBrokerContact(overrides: Record<string, unknown> = {}) {
  const id = nextId("contact");
  return {
    id,
    brokerFirmId: "firm-001",
    fullName: `Contact ${id}`,
    email: `${id}@example.com`,
    phone: null,
    title: null,
    metadata: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildFile(overrides: Record<string, unknown> = {}) {
  const id = nextId("file");
  return {
    id,
    dealId: "deal-001",
    portcoId: "portco-001",
    fileName: `file-${id}.pdf`,
    fileType: "im_pdf" as const,
    mimeType: "application/pdf",
    gdriveFileId: nextId("gdrive"),
    gdriveUrl: null,
    sizeBytes: 1024,
    processingStatus: "pending" as const,
    processedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildFinancialEntry(overrides: Record<string, unknown> = {}) {
  const id = nextId("fin");
  return {
    id,
    dealId: "deal-001",
    portcoId: "portco-001",
    period: "2024-Q1",
    periodType: "quarterly" as const,
    revenue: null,
    ebitda: null,
    netIncome: null,
    grossMarginPct: null,
    ebitdaMarginPct: null,
    cashFlow: null,
    customerCount: null,
    employeeCount: null,
    arr: null,
    purchasePrice: null,
    purchaseMultiple: null,
    source: "manual" as const,
    notes: null,
    metadata: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildComment(overrides: Record<string, unknown> = {}) {
  const id = nextId("comment");
  return {
    id,
    dealId: "deal-001",
    userId: "user-001",
    content: `Comment ${id}`,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildPortcoMembership(overrides: Record<string, unknown> = {}) {
  const id = nextId("membership");
  return {
    id,
    userId: "user-001",
    portcoId: "portco-001",
    role: "analyst" as const,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}
