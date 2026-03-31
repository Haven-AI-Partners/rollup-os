import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateInterviewSession = vi.fn();
vi.mock("@/lib/auth/interview-jwt", () => ({
  validateInterviewSession: (...args: unknown[]) => mockValidateInterviewSession(...args),
}));

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
  discoverySessions: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/interview/feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/interview/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockImplementation(() => ({
      limit: mockLimit,
      set: mockSet,
      then: (resolve: (v: unknown) => void) => resolve(undefined),
    }));
    mockLimit.mockResolvedValue([]);
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
  });

  it("returns 401 when no valid session", async () => {
    mockValidateInterviewSession.mockResolvedValue(null);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ rating: 5 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when rating is missing", async () => {
    mockValidateInterviewSession.mockResolvedValue("session-1");

    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Rating");
  });

  it("returns 400 when rating is invalid (out of range)", async () => {
    mockValidateInterviewSession.mockResolvedValue("session-1");

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ rating: 6 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when rating is not an integer", async () => {
    mockValidateInterviewSession.mockResolvedValue("session-1");

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ rating: 3.5 }));
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    mockValidateInterviewSession.mockResolvedValue("session-1");
    mockLimit.mockResolvedValue([{ id: "session-1" }]);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ rating: 4, tags: ["helpful"], comment: "Great" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
