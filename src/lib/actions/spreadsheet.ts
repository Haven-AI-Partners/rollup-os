"use server";

import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { downloadFile } from "@/lib/gdrive/client";

/** Maximum rows to return per sheet to prevent oversized responses */
const MAX_ROWS_PER_SHEET = 500;
/** Maximum sheets to process */
const MAX_SHEETS = 20;

export interface SpreadsheetCell {
  value: string;
  isFormula?: boolean;
}

export interface SpreadsheetSheet {
  name: string;
  headers: string[];
  rows: SpreadsheetCell[][];
  totalRows: number;
  truncated: boolean;
  columnCount: number;
}

export interface SpreadsheetData {
  sheets: SpreadsheetSheet[];
  fileName: string;
}

function cellToString(cell: ExcelJS.Cell): string {
  if (cell.type === ExcelJS.ValueType.Null) return "";
  if (cell.type === ExcelJS.ValueType.Date) {
    const d = cell.value as Date;
    return d.toISOString().split("T")[0];
  }
  return cell.text?.trim() ?? "";
}

async function parseWorkbook(buffer: Buffer): Promise<SpreadsheetSheet[]> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ExcelJS types expect legacy Buffer; Node 22+ Buffer<ArrayBufferLike> is incompatible
  await workbook.xlsx.load(buffer as any);

  const sheets: SpreadsheetSheet[] = [];

  workbook.eachSheet((sheet, sheetIndex) => {
    if (sheetIndex > MAX_SHEETS) return;

    const rows: SpreadsheetCell[][] = [];
    let maxCol = 0;
    let totalRows = 0;

    sheet.eachRow((row, rowNumber) => {
      totalRows = rowNumber;
      if (rows.length >= MAX_ROWS_PER_SHEET) return;

      const cells: SpreadsheetCell[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > maxCol) maxCol = colNumber;
        cells.push({
          value: cellToString(cell),
          isFormula: cell.type === ExcelJS.ValueType.Formula || undefined,
        });
      });
      rows.push(cells);
    });

    // Extract first row as headers if it exists
    const headers = rows.length > 0
      ? rows[0].map((c) => c.value)
      : [];

    sheets.push({
      name: sheet.name,
      headers,
      rows: rows.slice(1), // Data rows (without header)
      totalRows: Math.max(0, totalRows - 1),
      truncated: totalRows - 1 > MAX_ROWS_PER_SHEET,
      columnCount: maxCol,
    });
  });

  return sheets;
}

/**
 * Parse an Excel file from GDrive and return structured sheet data for preview.
 * If the file has been translated, also parses the translated version from Supabase Storage.
 */
export async function getSpreadsheetData(fileId: string): Promise<{
  original: SpreadsheetData;
  translated: SpreadsheetData | null;
} | null> {
  await requireAuth();

  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file || !file.gdriveFileId) return null;

  // Download original from GDrive
  const buffer = await downloadFile(file.portcoId, file.gdriveFileId);
  if (!buffer) return null;

  const originalSheets = await parseWorkbook(buffer);

  const original: SpreadsheetData = {
    sheets: originalSheets,
    fileName: file.fileName,
  };

  // Try to fetch translated version from Supabase Storage
  let translated: SpreadsheetData | null = null;
  const meta = file.metadata as { translatedFileUrl?: string } | null;

  if (meta?.translatedFileUrl) {
    try {
      const response = await fetch(meta.translatedFileUrl);
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        const translatedBuffer = Buffer.from(new Uint8Array(arrayBuf));
        const translatedSheets = await parseWorkbook(translatedBuffer);
        translated = {
          sheets: translatedSheets,
          fileName: `translated_${file.fileName}`,
        };
      }
    } catch {
      // Translated file not available — continue with original only
    }
  }

  return { original, translated };
}
