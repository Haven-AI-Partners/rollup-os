import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsert, mockValues, mockOnConflictDoUpdate, mockDelete, mockWhere } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockOnConflictDoUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const chain = {
    insert: mockInsert,
    values: mockValues,
    onConflictDoUpdate: mockOnConflictDoUpdate,
    delete: mockDelete,
    where: mockWhere,
  };
  mockInsert.mockReturnValue(chain);
  mockValues.mockReturnValue(chain);
  mockOnConflictDoUpdate.mockResolvedValue(undefined);
  mockDelete.mockReturnValue(chain);
  mockWhere.mockResolvedValue(undefined);
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  users: { clerkId: "clerkId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

// Mock svix Webhook
const { mockVerify, mockHeaders } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockHeaders: vi.fn(),
}));

vi.mock("svix", () => ({
  Webhook: class {
    verify = mockVerify;
  },
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = "test-secret";

    mockHeaders.mockResolvedValue({
      get: (name: string) => {
        const map: Record<string, string> = {
          "svix-id": "msg-123",
          "svix-timestamp": "1234567890",
          "svix-signature": "v1,abc123",
        };
        return map[name] ?? null;
      },
    });
  });

  it("returns 500 when CLERK_WEBHOOK_SECRET is missing", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Missing");
  });

  it("returns 400 when svix headers are missing", async () => {
    mockHeaders.mockResolvedValue({
      get: () => null,
    });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockVerify.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify({ type: "user.created", data: {} }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("handles user.created event", async () => {
    const event = {
      type: "user.created",
      data: {
        id: "clerk-001",
        email_addresses: [{ email_address: "test@example.com" }],
        first_name: "John",
        last_name: "Doe",
        image_url: "https://example.com/avatar.jpg",
      },
    };
    mockVerify.mockReturnValue(event);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(event),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("handles user.deleted event", async () => {
    const event = {
      type: "user.deleted",
      data: { id: "clerk-001", email_addresses: [], first_name: null, last_name: null, image_url: null },
    };
    mockVerify.mockReturnValue(event);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(event),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("handles unknown event type gracefully", async () => {
    const event = {
      type: "session.created",
      data: { id: "session-001", email_addresses: [], first_name: null, last_name: null, image_url: null },
    };
    mockVerify.mockReturnValue(event);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(event),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
