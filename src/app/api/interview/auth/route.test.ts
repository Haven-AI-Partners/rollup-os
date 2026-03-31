import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate, mockSet } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const chain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    update: mockUpdate,
    set: mockSet,
  };
  mockSelect.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  mockWhere.mockReturnValue(chain);
  mockLimit.mockResolvedValue([]);
  mockUpdate.mockReturnValue(chain);
  mockSet.mockReturnValue(chain);
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  discoverySessions: { id: "id", status: "status" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

const mockCompare = vi.fn();
vi.mock("bcryptjs", () => ({
  default: { compare: (...args: unknown[]) => mockCompare(...args) },
}));

const mockCreateInterviewToken = vi.fn();
vi.mock("@/lib/auth/interview-jwt", () => ({
  createInterviewToken: (...args: unknown[]) => mockCreateInterviewToken(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/interview/auth", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/interview/auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
    mockWhere.mockReturnValue({ limit: mockLimit, set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, set: mockSet });
  });

  it("returns 400 when missing sessionId", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ password: "pass" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing");
  });

  it("returns 400 when missing password", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ sessionId: "s-1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing");
  });

  it("returns 404 when session not found", async () => {
    mockLimit.mockResolvedValue([]);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ sessionId: "s-1", password: "pass" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when session is completed", async () => {
    mockLimit.mockResolvedValue([{ id: "s-1", status: "completed", passwordHash: "hash" }]);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ sessionId: "s-1", password: "pass" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when password is invalid", async () => {
    mockLimit.mockResolvedValue([{ id: "s-1", status: "pending", passwordHash: "hash" }]);
    mockCompare.mockResolvedValue(false);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ sessionId: "s-1", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 with cookie on success", async () => {
    mockLimit.mockResolvedValue([{ id: "s-1", status: "pending", passwordHash: "hash" }]);
    mockCompare.mockResolvedValue(true);
    // After the select chain, the update chain calls .set().where() which should resolve
    mockWhere.mockImplementation(() => ({
      limit: mockLimit,
      set: mockSet,
      then: (resolve: (v: unknown) => void) => resolve(undefined),
    }));
    mockCreateInterviewToken.mockResolvedValue("jwt-token-123");

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ sessionId: "s-1", password: "correct" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("discovery_session");
  });
});
