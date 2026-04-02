import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import JSZip from "jszip";

const { mockUser, mockGetUserPortcoRole } = vi.hoisted(() => ({
  mockUser: {
    id: "user-001",
    clerkId: "clerk-001",
    email: "test@example.com",
    fullName: "Test User",
  },
  mockGetUserPortcoRole: vi.fn().mockResolvedValue("admin"),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
  getUserPortcoRole: mockGetUserPortcoRole,
}));

// Mock DB — each test configures mockDbChain
const { mockDbChain } = vi.hoisted(() => ({
  mockDbChain: {
    selectResult: vi.fn(),
  },
}));

let dbSelectCallCount = 0;

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => {
        dbSelectCallCount++;
        return mockDbChain.selectResult(dbSelectCallCount);
      },
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  deals: { id: "id", portcoId: "portco_id", companyName: "company_name" },
  files: { id: "id", dealId: "deal_id", fileName: "file_name" },
  fileExtractions: {
    fileId: "file_id",
    contentExtraction: "content_extraction",
    translation: "translation",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
}));

import { GET } from "./route";

describe("GET /api/deals/[dealId]/extractions/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectCallCount = 0;
  });

  it("returns 404 when deal is not found", async () => {
    mockDbChain.selectResult.mockReturnValue({
      where: () => ({ limit: () => Promise.resolve([]) }),
    });

    const req = new NextRequest("http://localhost/api/deals/bad-id/extractions/download");
    const res = await GET(req, { params: Promise.resolve({ dealId: "bad-id" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not a member", async () => {
    mockGetUserPortcoRole.mockResolvedValueOnce(null);
    mockDbChain.selectResult.mockReturnValue({
      where: () => ({
        limit: () => Promise.resolve([{ portcoId: "portco-1", companyName: "Test Co" }]),
      }),
    });

    const req = new NextRequest("http://localhost/api/deals/deal-1/extractions/download");
    const res = await GET(req, { params: Promise.resolve({ dealId: "deal-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns a zip file with extractions", async () => {
    const extraction = {
      pages: [{ pageNumber: 1, content: "# Hello World" }],
      metadata: { totalPages: 1, documentLanguage: "en", documentTitle: null },
    };

    mockDbChain.selectResult.mockImplementation((callNum: number) => {
      if (callNum === 1) {
        return {
          where: () => ({
            limit: () => Promise.resolve([{ portcoId: "portco-1", companyName: "Test Co" }]),
          }),
        };
      }
      return {
        innerJoin: () => ({
          where: () =>
            Promise.resolve([
              { fileName: "report.pdf", contentExtraction: extraction, translation: null },
            ]),
        }),
      };
    });

    const req = new NextRequest("http://localhost/api/deals/deal-1/extractions/download");
    const res = await GET(req, { params: Promise.resolve({ dealId: "deal-1" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("Test Co-extractions.zip");

    const buffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);
    expect(files).toContain("report.md");

    const content = await zip.files["report.md"].async("string");
    expect(content).toBe("# Hello World");
  });

  it("returns 404 when no extractions exist", async () => {
    mockDbChain.selectResult.mockImplementation((callNum: number) => {
      if (callNum === 1) {
        return {
          where: () => ({
            limit: () => Promise.resolve([{ portcoId: "portco-1", companyName: "Test Co" }]),
          }),
        };
      }
      return {
        innerJoin: () => ({
          where: () => Promise.resolve([]),
        }),
      };
    });

    const req = new NextRequest("http://localhost/api/deals/deal-1/extractions/download");
    const res = await GET(req, { params: Promise.resolve({ dealId: "deal-1" }) });
    expect(res.status).toBe(404);
  });
});
