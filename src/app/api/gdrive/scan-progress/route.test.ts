import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAuth = vi.fn();
const mockGetUserPortcoRole = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  getUserPortcoRole: (...args: unknown[]) => mockGetUserPortcoRole(...args),
}));

let mockPortcoRow: {
  gdriveScanGeneration: number;
  gdriveLastCompleteScanAt: Date | null;
} | null = { gdriveScanGeneration: 3, gdriveLastCompleteScanAt: null };

let mockTotalFolders = 0;
let mockScannedFolders = 0;
let mockCachedFiles = 0;

vi.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeChain = (queryType: string): any => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.from = () => chain;
    chain.where = (condition: unknown) => {
      // Track the where clause to differentiate scanned vs total folders
      if (queryType === "folders") {
        chain._hasGteFilter = condition;
      }
      return chain;
    };
    chain.limit = () => {
      if (queryType === "portcos") {
        return mockPortcoRow ? [mockPortcoRow] : [];
      }
      return chain;
    };
    chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if (queryType === "portcos") {
        return Promise.resolve(mockPortcoRow ? [mockPortcoRow] : []).then(resolve, reject);
      }
      // For count queries, we need to figure out which count to return
      // The mock tracks calls in order: totalFolders, scannedFolders, cachedFiles
      return Promise.resolve([{ cnt: 0 }]).then(resolve, reject);
    };
    return chain;
  };

  // Track call index to return correct values for Promise.all
  let selectCallIndex = 0;

  return {
    db: {
      select: (fields?: Record<string, unknown>) => {
        const isCount = fields && "cnt" in fields;
        if (isCount) {
          const idx = selectCallIndex++;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const chain = makeChain("count") as any;
          chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
            let val = 0;
            if (idx === 0) val = mockTotalFolders;
            else if (idx === 1) val = mockScannedFolders;
            else if (idx === 2) val = mockCachedFiles;
            return Promise.resolve([{ cnt: val }]).then(resolve, reject);
          };
          return chain;
        }
        return makeChain("portcos");
      },
      _resetCallIndex: () => { selectCallIndex = 0; },
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  portcos: {
    _name: "portcos",
    id: "id",
    gdriveScanGeneration: "gdrive_scan_generation",
    gdriveLastCompleteScanAt: "gdrive_last_complete_scan_at",
  },
  gdriveFileCache: {
    _name: "gdrive_file_cache",
    portcoId: "portco_id",
  },
  gdriveScanFolders: {
    _name: "gdrive_scan_folders",
    portcoId: "portco_id",
    scanGeneration: "scan_generation",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  count: vi.fn(() => "cnt"),
}));

describe("GET /api/gdrive/scan-progress", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1" });
    mockGetUserPortcoRole.mockResolvedValue("admin");
    mockPortcoRow = { gdriveScanGeneration: 3, gdriveLastCompleteScanAt: null };
    mockTotalFolders = 0;
    mockScannedFolders = 0;
    mockCachedFiles = 0;

    // Reset the call index tracker
    const { db } = await import("@/lib/db");
    (db as unknown as { _resetCallIndex: () => void })._resetCallIndex();
  });

  it("returns 400 when portcoId is missing", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/gdrive/scan-progress");

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing portcoId");
  });

  it("returns 401 when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/scan-progress?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a member", async () => {
    mockGetUserPortcoRole.mockResolvedValue(null);

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/scan-progress?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns scan progress when scan is in progress", async () => {
    mockTotalFolders = 120;
    mockScannedFolders = 45;
    mockCachedFiles = 1234;

    const { db } = await import("@/lib/db");
    (db as unknown as { _resetCallIndex: () => void })._resetCallIndex();

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/scan-progress?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalFolders).toBe(120);
    expect(body.scannedFolders).toBe(45);
    expect(body.cachedFiles).toBe(1234);
    expect(body.scanInProgress).toBe(true);
    expect(body.lastCompleteScanAt).toBeNull();
  });

  it("returns scanInProgress=false when all folders scanned", async () => {
    mockTotalFolders = 50;
    mockScannedFolders = 50;
    mockCachedFiles = 500;
    mockPortcoRow = {
      gdriveScanGeneration: 3,
      gdriveLastCompleteScanAt: new Date("2024-06-15T10:00:00Z"),
    };

    const { db } = await import("@/lib/db");
    (db as unknown as { _resetCallIndex: () => void })._resetCallIndex();

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/scan-progress?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalFolders).toBe(50);
    expect(body.scannedFolders).toBe(50);
    expect(body.cachedFiles).toBe(500);
    expect(body.scanInProgress).toBe(false);
    expect(body.lastCompleteScanAt).toBe("2024-06-15T10:00:00.000Z");
  });

  it("returns zeros when no scan has run", async () => {
    mockTotalFolders = 0;
    mockScannedFolders = 0;
    mockCachedFiles = 0;

    const { db } = await import("@/lib/db");
    (db as unknown as { _resetCallIndex: () => void })._resetCallIndex();

    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost/api/gdrive/scan-progress?portcoId=portco-001",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalFolders).toBe(0);
    expect(body.scannedFolders).toBe(0);
    expect(body.cachedFiles).toBe(0);
    expect(body.scanInProgress).toBe(false);
  });
});
