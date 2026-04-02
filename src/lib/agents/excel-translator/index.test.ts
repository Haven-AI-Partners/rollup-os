import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockUploadTranslatedFile = vi.hoisted(() => vi.fn());
const mockGenerateObject = vi.hoisted(() => vi.fn());
const mockBuildExcelTranslationPrompt = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gdrive/client", () => ({
  downloadFile: mockDownloadFile,
}));

vi.mock("@/lib/storage", () => ({
  uploadTranslatedFile: mockUploadTranslatedFile,
}));

vi.mock("ai", () => ({
  generateObject: mockGenerateObject,
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-model"),
}));

vi.mock("./prompt", () => ({
  buildExcelTranslationPrompt: mockBuildExcelTranslationPrompt,
}));

import {
  containsCJK,
  collectTranslatableCells,
  batchCells,
  translateExcelFile,
} from "./index";
import type { TranslatableCell } from "./schema";
import ExcelJS from "exceljs";

// ── Unit tests for helper functions ──

describe("containsCJK", () => {
  it("detects Japanese hiragana", () => {
    expect(containsCJK("こんにちは")).toBe(true);
  });

  it("detects Japanese katakana", () => {
    expect(containsCJK("カタカナ")).toBe(true);
  });

  it("detects kanji", () => {
    expect(containsCJK("株式会社")).toBe(true);
  });

  it("detects mixed CJK and ASCII", () => {
    expect(containsCJK("Hello 世界")).toBe(true);
  });

  it("returns false for pure ASCII", () => {
    expect(containsCJK("Hello World")).toBe(false);
  });

  it("returns false for numbers", () => {
    expect(containsCJK("12345")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(containsCJK("")).toBe(false);
  });
});

describe("collectTranslatableCells", () => {
  it("collects cells with CJK content", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.getCell("A1").value = "会社名";
    sheet.getCell("B1").value = "Revenue";
    sheet.getCell("A2").value = "田中商事";
    sheet.getCell("B2").value = 1000000;

    const cells = collectTranslatableCells(workbook);

    expect(cells).toHaveLength(2);
    expect(cells[0].value).toBe("会社名");
    expect(cells[1].value).toBe("田中商事");
  });

  it("skips formula cells", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.getCell("A1").value = "合計";
    sheet.getCell("B1").value = { formula: "SUM(A1:A10)", result: 100 };

    const cells = collectTranslatableCells(workbook);

    expect(cells).toHaveLength(1);
    expect(cells[0].value).toBe("合計");
  });

  it("skips empty cells and numbers", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.getCell("A1").value = null;
    sheet.getCell("B1").value = 42;
    sheet.getCell("C1").value = "";

    const cells = collectTranslatableCells(workbook);

    expect(cells).toHaveLength(0);
  });

  it("skips pure ASCII strings", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.getCell("A1").value = "English only";
    sheet.getCell("B1").value = "売上高";

    const cells = collectTranslatableCells(workbook);

    expect(cells).toHaveLength(1);
    expect(cells[0].value).toBe("売上高");
  });
});

describe("batchCells", () => {
  it("creates a single batch when within limit", () => {
    const cells: TranslatableCell[] = [
      { sheetIndex: 1, row: 1, col: 1, value: "短い" },
      { sheetIndex: 1, row: 2, col: 1, value: "テスト" },
    ];

    const batches = batchCells(cells, 100);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it("splits into multiple batches based on character limit", () => {
    const cells: TranslatableCell[] = [
      { sheetIndex: 1, row: 1, col: 1, value: "あ".repeat(50) },
      { sheetIndex: 1, row: 2, col: 1, value: "い".repeat(50) },
      { sheetIndex: 1, row: 3, col: 1, value: "う".repeat(50) },
    ];

    const batches = batchCells(cells, 80);

    expect(batches).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    const batches = batchCells([]);
    expect(batches).toHaveLength(0);
  });

  it("handles single cell exceeding limit", () => {
    const cells: TranslatableCell[] = [
      { sheetIndex: 1, row: 1, col: 1, value: "大".repeat(200) },
    ];

    const batches = batchCells(cells, 100);

    // Single cell still goes into one batch even if it exceeds the limit
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
  });
});

// ── Integration test for translateExcelFile ──

describe("translateExcelFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildExcelTranslationPrompt.mockResolvedValue("Test prompt");
    mockUploadTranslatedFile.mockResolvedValue("https://storage.example.com/translated.xlsx");
  });

  it("translates CJK cells and uploads result", async () => {
    // Create a test workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("売上");
    sheet.getCell("A1").value = "会社名";
    sheet.getCell("B1").value = "売上高";
    sheet.getCell("A2").value = "田中商事";
    sheet.getCell("B2").value = 5000000;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    mockDownloadFile.mockResolvedValue(buffer);

    mockGenerateObject
      .mockResolvedValueOnce({
        object: {
          cells: [
            { id: 0, translated: "Company Name" },
            { id: 1, translated: "Revenue" },
            { id: 2, translated: "Tanaka Trading" },
          ],
        },
      })
      // Sheet name translation
      .mockResolvedValueOnce({
        object: {
          cells: [{ id: 0, translated: "Sales" }],
        },
      });

    const result = await translateExcelFile("portco-1", "file-1", "gdrive-1");

    expect(mockDownloadFile).toHaveBeenCalledWith("portco-1", "gdrive-1");
    expect(mockUploadTranslatedFile).toHaveBeenCalledWith(
      "portco-1",
      "file-1",
      expect.any(Buffer),
      expect.stringContaining("translated_"),
    );
    expect(result.translatedFileUrl).toBe("https://storage.example.com/translated.xlsx");
    expect(result.cellsTranslated).toBe(3);
    expect(result.sheetsProcessed).toBe(1);
    expect(result.sourceLanguage).toBe("ja");
  });

  it("handles files with no CJK content", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Data");
    sheet.getCell("A1").value = "Name";
    sheet.getCell("B1").value = 100;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    mockDownloadFile.mockResolvedValue(buffer);

    const result = await translateExcelFile("portco-1", "file-1", "gdrive-1");

    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(result.cellsTranslated).toBe(0);
    expect(result.sourceLanguage).toBe("en");
  });

  it("throws when GDrive download fails", async () => {
    mockDownloadFile.mockResolvedValue(null);

    await expect(
      translateExcelFile("portco-1", "file-1", "gdrive-1"),
    ).rejects.toThrow("Failed to download file from GDrive");
  });
});
