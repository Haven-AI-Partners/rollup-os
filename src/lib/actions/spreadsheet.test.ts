import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import ExcelJS from "exceljs";

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/gdrive/client", () => ({
  downloadFile: mockDownloadFile,
}));

// Mock DB as a sequential value queue
const dbResults: unknown[] = [];

vi.mock("@/lib/db", () => {
  const chain: any = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          if (dbResults.length === 0) return undefined;
          const val = dbResults.shift();
          return (resolve: (v: unknown) => void) => {
            resolve(val);
            return { then: () => {} };
          };
        }
        return () => chain;
      },
    },
  );
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  files: { id: "id", portcoId: "portcoId", gdriveFileId: "gdriveFileId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// Replace global fetch for translated file download
const originalFetch = globalThis.fetch;

async function makeTestBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("テスト");
  sheet.getCell("A1").value = "会社名";
  sheet.getCell("B1").value = "売上高";
  sheet.getCell("A2").value = "田中商事";
  sheet.getCell("B2").value = 5000000;
  sheet.getCell("A3").value = new Date("2024-01-15");
  sheet.getCell("B3").value = { formula: "SUM(B2:B2)", result: 5000000 };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("getSpreadsheetData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbResults.length = 0;
    mockRequireAuth.mockResolvedValue({ id: "user-1" });
    globalThis.fetch = mockFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns null when file not found", async () => {
    dbResults.push([]);

    const { getSpreadsheetData } = await import("./spreadsheet");
    const result = await getSpreadsheetData("file-1");

    expect(result).toBeNull();
  });

  it("returns null when file has no gdriveFileId", async () => {
    dbResults.push([{ id: "file-1", portcoId: "p1", gdriveFileId: null, fileName: "test.xlsx", metadata: null }]);

    const { getSpreadsheetData } = await import("./spreadsheet");
    const result = await getSpreadsheetData("file-1");

    expect(result).toBeNull();
  });

  it("returns null when GDrive download fails", async () => {
    dbResults.push([{ id: "file-1", portcoId: "p1", gdriveFileId: "gf-1", fileName: "test.xlsx", metadata: null }]);
    mockDownloadFile.mockResolvedValue(null);

    const { getSpreadsheetData } = await import("./spreadsheet");
    const result = await getSpreadsheetData("file-1");

    expect(result).toBeNull();
  });

  it("parses workbook and returns sheet data", async () => {
    const buffer = await makeTestBuffer();
    dbResults.push([{ id: "file-1", portcoId: "p1", gdriveFileId: "gf-1", fileName: "test.xlsx", metadata: null }]);
    mockDownloadFile.mockResolvedValue(buffer);

    const { getSpreadsheetData } = await import("./spreadsheet");
    const result = await getSpreadsheetData("file-1");

    expect(result).not.toBeNull();
    expect(result!.original.sheets).toHaveLength(1);
    expect(result!.original.sheets[0].name).toBe("テスト");
    expect(result!.original.sheets[0].headers).toEqual(["会社名", "売上高"]);
    expect(result!.original.sheets[0].rows).toHaveLength(2); // 2 data rows after header
    expect(result!.original.fileName).toBe("test.xlsx");
    expect(result!.translated).toBeNull();
  });

  it("handles date and formula cells", async () => {
    const buffer = await makeTestBuffer();
    dbResults.push([{ id: "file-1", portcoId: "p1", gdriveFileId: "gf-1", fileName: "test.xlsx", metadata: null }]);
    mockDownloadFile.mockResolvedValue(buffer);

    const { getSpreadsheetData } = await import("./spreadsheet");
    const result = await getSpreadsheetData("file-1");

    const rows = result!.original.sheets[0].rows;
    // Row 2 (index 1): date cell + formula cell
    expect(rows[1][0].value).toMatch(/2024-01-15/);
    expect(rows[1][1].isFormula).toBe(true);
  });

  it("fetches translated version when URL is available", async () => {
    const buffer = await makeTestBuffer();
    dbResults.push([{
      id: "file-1",
      portcoId: "p1",
      gdriveFileId: "gf-1",
      fileName: "test.xlsx",
      metadata: { translatedFileUrl: "https://storage.example.com/translated.xlsx" },
    }]);
    mockDownloadFile.mockResolvedValue(buffer);

    // Mock fetch for translated file
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    });

    const { getSpreadsheetData } = await import("./spreadsheet");
    const result = await getSpreadsheetData("file-1");

    expect(result!.translated).not.toBeNull();
    expect(result!.translated!.fileName).toBe("translated_test.xlsx");
    expect(result!.translated!.sheets).toHaveLength(1);
  });

  it("returns null translated when fetch fails", async () => {
    const buffer = await makeTestBuffer();
    dbResults.push([{
      id: "file-1",
      portcoId: "p1",
      gdriveFileId: "gf-1",
      fileName: "test.xlsx",
      metadata: { translatedFileUrl: "https://storage.example.com/translated.xlsx" },
    }]);
    mockDownloadFile.mockResolvedValue(buffer);
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { getSpreadsheetData } = await import("./spreadsheet");
    const result = await getSpreadsheetData("file-1");

    expect(result!.original).not.toBeNull();
    expect(result!.translated).toBeNull();
  });

  it("returns null translated when fetch returns non-ok response", async () => {
    const buffer = await makeTestBuffer();
    dbResults.push([{
      id: "file-1",
      portcoId: "p1",
      gdriveFileId: "gf-1",
      fileName: "test.xlsx",
      metadata: { translatedFileUrl: "https://storage.example.com/translated.xlsx" },
    }]);
    mockDownloadFile.mockResolvedValue(buffer);
    mockFetch.mockResolvedValue({ ok: false });

    const { getSpreadsheetData } = await import("./spreadsheet");
    const result = await getSpreadsheetData("file-1");

    expect(result!.translated).toBeNull();
  });
});
