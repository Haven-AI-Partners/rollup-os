import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUrl = vi.fn();
vi.mock("@/lib/gdrive/client", () => ({
  getAuthUrl: (...args: unknown[]) => mockGetAuthUrl(...args),
}));

describe("GET /api/auth/gdrive/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when missing portcoSlug", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/auth/gdrive/connect");

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing portcoSlug");
  });

  it("returns URL on success", async () => {
    mockGetAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/auth?...");

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/auth/gdrive/connect?portcoSlug=acme");

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://accounts.google.com/o/oauth2/auth?...");
    expect(mockGetAuthUrl).toHaveBeenCalledWith("acme");
  });
});
