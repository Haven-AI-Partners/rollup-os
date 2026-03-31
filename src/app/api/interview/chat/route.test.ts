import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockValidateSession, mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate, mockSet } = vi.hoisted(() => ({
  mockValidateSession: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("@/lib/auth/interview-jwt", () => ({
  validateInterviewSession: mockValidateSession,
}));

vi.mock("@/lib/db", () => {
  const chain = () => ({
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    update: mockUpdate,
    set: mockSet,
  });
  for (const fn of [mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate, mockSet]) {
    fn.mockReturnValue(chain());
  }
  return { db: chain() };
});

vi.mock("@/lib/db/schema", () => ({
  discoverySessions: { id: "id", campaignId: "campaignId", employeeId: "employeeId", status: "status" },
  discoveryCampaigns: { id: "id", dealId: "dealId", description: "description", promptConfig: "promptConfig" },
  companyEmployees: { id: "id", name: "name" },
  deals: { companyName: "companyName" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
}));

const mockRunInterviewStream = vi.fn();
const mockSaveMessage = vi.fn();
const mockLoadMessages = vi.fn();

vi.mock("@/lib/agents/discovery-interviewer", () => ({
  runInterviewStream: mockRunInterviewStream,
  saveMessage: mockSaveMessage,
  loadMessages: mockLoadMessages,
}));

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/interview/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/interview/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is invalid", async () => {
    mockValidateSession.mockResolvedValue(null);

    const { POST } = await import("./route");
    const res = await POST(buildRequest({ messages: [] }));

    expect(res.status).toBe(401);
  });

  it("returns 400 when JSON is invalid", async () => {
    mockValidateSession.mockResolvedValue("session-001");

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/interview/chat", {
      method: "POST",
      body: "not json{",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when no user message", async () => {
    mockValidateSession.mockResolvedValue("session-001");

    const { POST } = await import("./route");
    const res = await POST(buildRequest({ messages: [] }));

    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe("No user message");
  });

  it("returns 400 when session is completed", async () => {
    mockValidateSession.mockResolvedValue("session-001");
    mockLimit.mockResolvedValueOnce([{ id: "session-001", status: "completed", campaignId: "c1", employeeId: "e1" }]);

    const { POST } = await import("./route");
    const res = await POST(
      buildRequest({
        messages: [{ role: "user", parts: [{ type: "text", text: "Hello" }] }],
      })
    );

    expect(res.status).toBe(400);
  });
});
