import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockHandleCallback = vi.fn();
vi.mock("@/lib/gdrive/client", () => ({
  handleCallback: (...args: unknown[]) => mockHandleCallback(...args),
}));

describe("GET /api/auth/gdrive/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when missing code", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/auth/gdrive/callback?state=acme");

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing code or state");
  });

  it("returns 400 when missing state", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/auth/gdrive/callback?code=auth-code");

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing code or state");
  });

  it("returns 400 when state has invalid characters", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/auth/gdrive/callback?code=auth-code&state=../invalid!slug"
    );

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid state");
  });

  it("redirects to settings on success", async () => {
    mockHandleCallback.mockResolvedValue({ refresh_token: "rt-123" });

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/auth/gdrive/callback?code=auth-code&state=acme"
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/acme/settings?gdrive=connected");
    expect(mockHandleCallback).toHaveBeenCalledWith("auth-code", "acme");
  });

  it("redirects to error page on handleCallback failure", async () => {
    mockHandleCallback.mockRejectedValue(new Error("Token exchange failed"));

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/auth/gdrive/callback?code=bad-code&state=acme"
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/acme/settings?gdrive_error=auth_failed");
  });
});
