import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRetrieve = vi.fn();

vi.mock("@trigger.dev/sdk", () => ({
  runs: { retrieve: mockRetrieve },
}));

describe("GET /api/processing/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when runId is missing", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/processing/status");

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing runId");
  });

  it("returns run status when found", async () => {
    mockRetrieve.mockResolvedValue({
      id: "run-001",
      status: "COMPLETED",
      output: { score: 4.2 },
      error: null,
      finishedAt: "2024-01-01T00:00:00Z",
    });

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/processing/status?runId=run-001");

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("COMPLETED");
    expect(body.output).toEqual({ score: 4.2 });
  });

  it("returns 404 when run is not found", async () => {
    mockRetrieve.mockRejectedValue(new Error("Not found"));

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/processing/status?runId=nonexistent");

    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});
