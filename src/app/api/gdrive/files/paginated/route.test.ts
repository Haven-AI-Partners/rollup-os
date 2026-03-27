import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAuth = vi.fn();
const mockGetUserPortcoRole = vi.fn();
const mockListFilesPage = vi.fn();
const mockListFilesRecursive = vi.fn();
const mockIsFileCacheFresh = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  getUserPortcoRole: (...args: unknown[]) => mockGetUserPortcoRole(...args),
}));

vi.mock("@/lib/gdrive/scanner", () => ({
  listFilesPage: (...args: unknown[]) => mockListFilesPage(...args),
  listFilesRecursive: (...args: unknown[]) => mockListFilesRecursive(...args),
  isFileCacheFresh: (...args: unknown[]) => mockIsFileCacheFresh(...args),
}));

// Mock next/server's after() — it runs callbacks after response
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => Promise<void>) => { fn(); },
  };
});

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
  chain.then = (resolve: (v: unknown[]) => void) => {
    if (selectContext === "files") {
      return Promise.resolve([]).then(resolve);
    }
    return Promise.resolve([]).then(resolve);
  };
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  files: { _name: "files", gdriveFileId: "gdriveFileId", processingStatus: "processingStatus", dealId: "dealId", fileType: "fileType" },
  portcos: { _name: "portcos", gdriveServiceAccountEnc: "gdriveServiceAccountEnc", id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  inArray: vi.fn(),
  eq: vi.fn(),
}));

function makePageResult(count: number, hasMore: boolean, total: number | null = count) {
  return {
    files: Array.from({ length: count }, (_, i) => ({
      id: `file-${i}`,
      name: `File ${i}.pdf`,
      mimeType: "application/pdf",
      size: "1024",
      modifiedTime: "2024-01-01T00:00:00Z",
      webViewLink: `https://drive.google.com/file/${i}`,
      parentPath: "IMs",
    })),
    total,
    hasMore,
  };
}

describe("GET /api/gdrive/files/paginated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1" });
    mockGetUserPortcoRole.mockResolvedValue("admin");
    mockListFilesPage.mockResolvedValue(makePageResult(0, false, 0));
    mockIsFileCacheFresh.mockReturnValue(true);
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
    mockListFilesPage.mockResolvedValue(makePageResult(50, true, 75));

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

  it("returns null nextCursor when no more files", async () => {
    mockListFilesPage.mockResolvedValue(makePageResult(10, false, 10));

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

  it("passes cursor and limit to listFilesPage", async () => {
    mockListFilesPage.mockResolvedValue(makePageResult(10, true, null));

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001&cursor=50&limit=10",
    );

    await GET(req);
    expect(mockListFilesPage).toHaveBeenCalledWith("portco-001", 50, 10);
  });

  it("caps limit at 100", async () => {
    mockListFilesPage.mockResolvedValue(makePageResult(100, true, null));

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001&limit=500",
    );

    await GET(req);
    expect(mockListFilesPage).toHaveBeenCalledWith("portco-001", 0, 100);
  });

  it("returns null total when full crawl not complete", async () => {
    mockListFilesPage.mockResolvedValue(makePageResult(50, true, null));

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001",
    );

    const res = await GET(req);
    const body = await res.json();
    expect(body.total).toBeNull();
    expect(body.nextCursor).toBe(50);
  });

  it("triggers background cache warming when cache is not fresh", async () => {
    mockIsFileCacheFresh.mockReturnValue(false);
    mockListFilesPage.mockResolvedValue(makePageResult(10, false, 10));
    mockListFilesRecursive.mockResolvedValue([]);

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001",
    );

    await GET(req);
    expect(mockListFilesRecursive).toHaveBeenCalledWith("portco-001");
  });

  it("skips background warming when cache is fresh", async () => {
    mockIsFileCacheFresh.mockReturnValue(true);
    mockListFilesPage.mockResolvedValue(makePageResult(10, false, 10));

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001",
    );

    await GET(req);
    expect(mockListFilesRecursive).not.toHaveBeenCalled();
  });
});
