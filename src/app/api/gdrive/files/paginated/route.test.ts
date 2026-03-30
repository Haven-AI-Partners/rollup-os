import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAuth = vi.fn();
const mockGetUserPortcoRole = vi.fn();
const mockCrawlAndSyncFiles = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  getUserPortcoRole: (...args: unknown[]) => mockGetUserPortcoRole(...args),
}));

vi.mock("@/lib/gdrive/scanner", () => ({
  crawlAndSyncFiles: (...args: unknown[]) => mockCrawlAndSyncFiles(...args),
}));

// Mock next/server's after() — it runs callbacks after response
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => Promise<void>) => { fn(); },
  };
});

// Build a mock DB that supports the queries the route makes
let mockCacheRows: Array<{
  gdriveFileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  modifiedTime: Date | null;
  webViewLink: string | null;
  parentPath: string;
}> = [];
let mockTotalCount = 0;
let mockProcessedFiles: Array<{
  gdriveFileId: string;
  processingStatus: string;
  dealId: string | null;
  fileType: string | null;
  classificationConfidence: string | null;
  classifiedBy: string | null;
}> = [];

vi.mock("@/lib/db", () => {
  // Each chain tracks its own query type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeChain = (initialType: "portcos" | "cache" | "count" | "files" = "portcos"): any => {
    let queryType = initialType;
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.from = (table: { _name?: string }) => {
      // Don't override count type — it's set at select() time
      if (queryType !== "count") {
        if (table?._name === "gdrive_file_cache") queryType = "cache";
        if (table?._name === "files") queryType = "files";
      }
      return chain;
    };
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.offset = () => chain;
    chain.limit = () => {
      if (queryType === "portcos") {
        return [{ gdriveServiceAccountEnc: "enc-token" }];
      }
      return chain;
    };
    // Make the chain thenable for Promise.all
    chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if (queryType === "cache") {
        return Promise.resolve(mockCacheRows).then(resolve, reject);
      }
      if (queryType === "count") {
        return Promise.resolve([{ count: mockTotalCount }]).then(resolve, reject);
      }
      if (queryType === "files") {
        return Promise.resolve(mockProcessedFiles).then(resolve, reject);
      }
      return Promise.resolve([]).then(resolve, reject);
    };
    return chain;
  };

  return {
    db: {
      select: (fields?: Record<string, unknown>) => {
        const isCount = fields && "count" in fields;
        return makeChain(isCount ? "count" : "portcos");
      },
      from: (table: { _name?: string }) => {
        const chain = makeChain();
        return chain.from(table);
      },
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  files: { _name: "files", gdriveFileId: "gdriveFileId", processingStatus: "processingStatus", dealId: "dealId", fileType: "fileType", classificationConfidence: "classificationConfidence", classifiedBy: "classifiedBy" },
  portcos: { _name: "portcos", gdriveServiceAccountEnc: "gdriveServiceAccountEnc", id: "id" },
  gdriveFileCache: { _name: "gdrive_file_cache", portcoId: "portco_id", gdriveFileId: "gdrive_file_id", modifiedTime: "modified_time", fileName: "file_name", parentPath: "parent_path" },
}));

vi.mock("drizzle-orm", () => ({
  inArray: vi.fn(),
  eq: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  count: vi.fn(() => "count"),
  sql: vi.fn(),
}));

function makeCacheRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    gdriveFileId: `file-${i}`,
    fileName: `File ${i}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 1024,
    modifiedTime: new Date("2024-01-01T00:00:00Z"),
    webViewLink: `https://drive.google.com/file/${i}`,
    parentPath: "IMs",
  }));
}

describe("GET /api/gdrive/files/paginated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1" });
    mockGetUserPortcoRole.mockResolvedValue("admin");
    mockCacheRows = [];
    mockTotalCount = 0;
    mockProcessedFiles = [];
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

  it("returns syncing=true when cache is empty and triggers background sync", async () => {
    mockTotalCount = 0;
    mockCacheRows = [];
    mockCrawlAndSyncFiles.mockResolvedValue({ files: [], upserted: 0, removed: 0 });

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.syncing).toBe(true);
    expect(body.files).toHaveLength(0);
    expect(mockCrawlAndSyncFiles).toHaveBeenCalledWith("portco-001");
  });

  it("returns files from DB cache with correct pagination", async () => {
    mockCacheRows = makeCacheRows(50);
    mockTotalCount = 75;

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
    mockCacheRows = makeCacheRows(10);
    mockTotalCount = 10;

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

  it("returns files with null nextCursor in folder mode when under page size", async () => {
    mockCacheRows = makeCacheRows(100);
    mockTotalCount = 100;

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001&mode=folder",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(100);
    expect(body.nextCursor).toBeNull();
    expect(body.total).toBe(100);
  });

  it("returns nextCursor in folder mode when more files exist", async () => {
    mockCacheRows = makeCacheRows(500);
    mockTotalCount = 1200;

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001&mode=folder",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(500);
    expect(body.nextCursor).toBe(500);
    expect(body.total).toBe(1200);
  });

  it("supports cursor parameter in folder mode for subsequent pages", async () => {
    mockCacheRows = makeCacheRows(500);
    mockTotalCount = 1200;

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001&mode=folder&cursor=500",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(500);
    expect(body.nextCursor).toBe(1000);
    expect(body.total).toBe(1200);
  });

  it("includes processedMap for files with processing status", async () => {
    mockCacheRows = makeCacheRows(2);
    mockTotalCount = 2;
    mockProcessedFiles = [
      { gdriveFileId: "file-0", processingStatus: "completed", dealId: "deal-1", fileType: "im_pdf", classificationConfidence: "0.95", classifiedBy: "auto" },
    ];

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/files/paginated?portcoId=portco-001",
    );

    const res = await GET(req);
    const body = await res.json();
    expect(body.processedMap["file-0"]).toEqual({
      status: "completed",
      dealId: "deal-1",
      fileType: "im_pdf",
      classificationConfidence: "0.95",
      classifiedBy: "auto",
    });
    expect(body.processedMap["file-1"]).toBeUndefined();
  });
});
