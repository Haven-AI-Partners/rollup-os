import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAuth = vi.fn();
const mockGetUserPortcoRole = vi.fn();
const mockListFilesRecursive = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  getUserPortcoRole: (...args: unknown[]) => mockGetUserPortcoRole(...args),
}));

vi.mock("@/lib/gdrive/scanner", () => ({
  listFilesRecursive: (...args: unknown[]) => mockListFilesRecursive(...args),
}));

// Track which table is being queried so we can return different results
let selectContext: "portcos" | "files" = "portcos";

vi.mock("@/lib/db", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => {
    selectContext = "portcos";
    return chain;
  };
  chain.from = (table: { _name?: string }) => {
    if (table?._name === "files") selectContext = "files";
    return chain;
  };
  chain.where = () => chain;
  chain.limit = () => {
    if (selectContext === "portcos") {
      return [{ gdriveServiceAccountEnc: "enc-token" }];
    }
    return [];
  };
  // For files query (no .limit() call), the chain itself acts as the result
  // We need the chain to be thenable for queries without .limit()
  chain.then = (resolve: (v: unknown[]) => void) => {
    if (selectContext === "files") {
      return Promise.resolve([]).then(resolve);
    }
    return Promise.resolve([]).then(resolve);
  };
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  files: { _name: "files", gdriveFileId: "gdriveFileId", processingStatus: "processingStatus", dealId: "dealId" },
  portcos: { _name: "portcos", gdriveServiceAccountEnc: "gdriveServiceAccountEnc", id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  inArray: vi.fn(),
  eq: vi.fn(),
}));

function makeFiles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `file-${i}`,
    name: `File ${i}.pdf`,
    mimeType: "application/pdf",
    size: "1024",
    modifiedTime: "2024-01-01T00:00:00Z",
    webViewLink: `https://drive.google.com/file/${i}`,
    parentPath: "IMs",
  }));
}

describe("GET /api/gdrive/files/paginated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1" });
    mockGetUserPortcoRole.mockResolvedValue("admin");
    mockListFilesRecursive.mockResolvedValue([]);
  });

  it("returns 400 when portcoId is missing", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/gdrive/files/paginated");

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing portcoId");
  });

  it("returns 401 when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a member", async () => {
    mockGetUserPortcoRole.mockResolvedValue(null);

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns first page with nextCursor when more files exist", async () => {
    const allFiles = makeFiles(75);
    mockListFilesRecursive.mockResolvedValue(allFiles);

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(50);
    expect(body.nextCursor).toBe(50);
    expect(body.total).toBe(75);
  });

  it("returns files from cursor offset", async () => {
    const allFiles = makeFiles(75);
    mockListFilesRecursive.mockResolvedValue(allFiles);

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001&cursor=50",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(25);
    expect(body.nextCursor).toBeNull();
    expect(body.total).toBe(75);
  });

  it("respects custom limit parameter", async () => {
    const allFiles = makeFiles(30);
    mockListFilesRecursive.mockResolvedValue(allFiles);

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001&limit=10",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(10);
    expect(body.nextCursor).toBe(10);
  });

  it("caps limit at 100", async () => {
    const allFiles = makeFiles(200);
    mockListFilesRecursive.mockResolvedValue(allFiles);

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001&limit=500",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(100);
  });

  it("returns null nextCursor when all files fit in one page", async () => {
    const allFiles = makeFiles(10);
    mockListFilesRecursive.mockResolvedValue(allFiles);

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(10);
    expect(body.nextCursor).toBeNull();
    expect(body.total).toBe(10);
  });
});
