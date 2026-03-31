import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockRequireAuth, mockGetUserPortcoRole, mockGetDeal } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com" },
  mockRequireAuth: vi.fn(),
  mockGetUserPortcoRole: vi.fn(),
  mockGetDeal: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserPortcoRole: mockGetUserPortcoRole,
}));

vi.mock("@/lib/db/cached-queries", () => ({
  getDeal: mockGetDeal,
}));

vi.mock("@/lib/db", () => {
  const handler: ProxyHandler<object> = {
    get() {
      return () => new Proxy({}, handler);
    },
  };
  return { db: new Proxy({}, handler) };
});

vi.mock("@/lib/db/schema", () => ({
  companyProfiles: { dealId: "dealId", rawExtraction: "rawExtraction" },
  dealThesisNodes: { dealId: "dealId", label: "label", status: "status", value: "value", notes: "notes", templateNodeId: "templateNodeId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
}));

vi.mock("ai", () => ({
  streamText: vi.fn().mockReturnValue({
    toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream", { status: 200 })),
  }),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock("@ai-sdk/google", () => ({
  google: Object.assign(vi.fn().mockReturnValue("mock-model"), {
    tools: {
      googleSearch: vi.fn().mockReturnValue("mock-search"),
    },
  }),
}));

describe("POST /api/chat/deal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  it("returns 400 when dealId is missing", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/chat/deal", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when deal not found", async () => {
    mockGetDeal.mockResolvedValue(null);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/chat/deal", {
      method: "POST",
      body: JSON.stringify({ messages: [], dealId: "deal-999" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user not a member of portco", async () => {
    mockGetDeal.mockResolvedValue({ id: "deal-001", portcoId: "portco-001", companyName: "Test" });
    mockGetUserPortcoRole.mockResolvedValue(null);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/chat/deal", {
      method: "POST",
      body: JSON.stringify({ messages: [], dealId: "deal-001" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("checks auth before proceeding", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/chat/deal", {
      method: "POST",
      body: JSON.stringify({ messages: [], dealId: "deal-001" }),
    });
    await expect(POST(req)).rejects.toThrow("Unauthorized");
  });
});
