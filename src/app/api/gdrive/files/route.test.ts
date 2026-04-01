import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

const mockListFiles = vi.fn();

vi.mock("@/lib/gdrive/client", () => ({
  listFiles: (...args: unknown[]) => mockListFiles(...args),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
  getUserPortcoRole: vi.fn().mockResolvedValue("analyst"),
}));

describe("GET /api/gdrive/files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when portcoId is missing", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/gdrive/files");

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing portcoId");
  });

  it("returns files when found", async () => {
    const files = [
      { id: "file-1", name: "IM_Corp.pdf", mimeType: "application/pdf" },
    ];
    mockListFiles.mockResolvedValue({ files });

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/gdrive/files?portcoId=portco-001");

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toEqual(files);
  });

  it("returns empty array when no connection", async () => {
    mockListFiles.mockResolvedValue(null);

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/gdrive/files?portcoId=portco-001");

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toEqual([]);
  });

  it("returns 500 when GDrive errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockListFiles.mockRejectedValue(new Error("GDrive auth failed"));

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/gdrive/files?portcoId=portco-001");

    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
