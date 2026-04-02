import ExcelJS from "exceljs";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { downloadFile } from "@/lib/gdrive/client";
import { uploadTranslatedFile } from "@/lib/storage";
import { cellTranslationResultSchema } from "./schema";
import { buildExcelTranslationPrompt } from "./prompt";
import type { TranslatableCell, ExcelTranslationResult } from "./schema";

export const MODEL_ID = "gemini-2.5-flash";

/** Maximum characters per LLM batch to stay within context limits */
const BATCH_CHAR_LIMIT = 4000;

/** Regex to detect CJK characters (Chinese, Japanese, Korean) */
const CJK_REGEX = /[\u3000-\u9fff\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff]/;

/** Check if a string contains CJK characters */
export function containsCJK(text: string): boolean {
  return CJK_REGEX.test(text);
}

/**
 * Check if a cell value is translatable (non-empty string with CJK content).
 * Skips numbers, dates, booleans, formulas, and pure-ASCII text.
 */
export function isTranslatable(cell: ExcelJS.Cell): boolean {
  if (cell.type === ExcelJS.ValueType.Formula) return false;
  if (cell.type === ExcelJS.ValueType.Date) return false;
  if (cell.type === ExcelJS.ValueType.Number) return false;
  if (cell.type === ExcelJS.ValueType.Boolean) return false;
  if (cell.type === ExcelJS.ValueType.Null) return false;

  const value = cell.text?.trim();
  if (!value) return false;

  return containsCJK(value);
}

/**
 * Collect all translatable cells from a workbook.
 */
export function collectTranslatableCells(
  workbook: ExcelJS.Workbook,
): TranslatableCell[] {
  const cells: TranslatableCell[] = [];

  workbook.eachSheet((sheet, sheetIndex) => {
    sheet.eachRow((row) => {
      row.eachCell((cell, colNumber) => {
        if (isTranslatable(cell)) {
          cells.push({
            sheetIndex,
            row: row.number,
            col: colNumber,
            value: cell.text.trim(),
          });
        }
      });
    });
  });

  return cells;
}

/**
 * Group cells into batches that fit within the character limit.
 */
export function batchCells(
  cells: TranslatableCell[],
  charLimit: number = BATCH_CHAR_LIMIT,
): TranslatableCell[][] {
  const batches: TranslatableCell[][] = [];
  let currentBatch: TranslatableCell[] = [];
  let currentChars = 0;

  for (const cell of cells) {
    if (currentChars + cell.value.length > charLimit && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(cell);
    currentChars += cell.value.length;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Translate a batch of cell values via LLM.
 */
async function translateBatch(
  cells: TranslatableCell[],
  systemPrompt: string,
): Promise<Map<number, string>> {
  const input = cells
    .map((c, i) => `[${i}] ${c.value}`)
    .join("\n");

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: cellTranslationResultSchema,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Translate the following cell values from Japanese to English:\n\n${input}`,
      },
    ],
    temperature: 0,
    seed: 42,
  });

  const resultMap = new Map<number, string>();
  for (const cell of object.cells) {
    resultMap.set(cell.id, cell.translated);
  }
  return resultMap;
}

/**
 * Translate CJK sheet names and return a mapping of old → new names.
 */
async function translateSheetNames(
  workbook: ExcelJS.Workbook,
  systemPrompt: string,
): Promise<void> {
  const sheetsToTranslate: Array<{ index: number; name: string }> = [];

  workbook.eachSheet((sheet, index) => {
    if (containsCJK(sheet.name)) {
      sheetsToTranslate.push({ index, name: sheet.name });
    }
  });

  if (sheetsToTranslate.length === 0) return;

  const input = sheetsToTranslate
    .map((s, i) => `[${i}] ${s.name}`)
    .join("\n");

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: cellTranslationResultSchema,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Translate the following spreadsheet tab names from Japanese to English. Keep translations concise (suitable for a tab name):\n\n${input}`,
      },
    ],
    temperature: 0,
    seed: 42,
  });

  for (const result of object.cells) {
    const sheetInfo = sheetsToTranslate[result.id];
    if (sheetInfo) {
      const sheet = workbook.getWorksheet(sheetInfo.index);
      if (sheet) {
        sheet.name = result.translated;
      }
    }
  }
}

/**
 * Main entry point: translate an Excel file from GDrive.
 *
 * 1. Downloads file from GDrive
 * 2. Parses with ExcelJS
 * 3. Collects translatable CJK cells
 * 4. Translates in batches via Gemini
 * 5. Writes translations back in-place
 * 6. Uploads to Supabase Storage
 */
export async function translateExcelFile(
  portcoId: string,
  fileId: string,
  gdriveFileId: string,
): Promise<ExcelTranslationResult> {
  // 1. Download from GDrive
  const buffer = await downloadFile(portcoId, gdriveFileId);
  if (!buffer) {
    throw new Error("Failed to download file from GDrive");
  }

  // 2. Parse workbook
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ExcelJS types expect legacy Buffer; Node 22+ Buffer<ArrayBufferLike> is incompatible
  await workbook.xlsx.load(buffer as any);

  // 3. Collect translatable cells
  const cells = collectTranslatableCells(workbook);

  if (cells.length === 0) {
    // No CJK content — upload as-is
    const fileName = `translated_${Date.now()}.xlsx`;
    const outputBuffer = Buffer.from(new Uint8Array(await workbook.xlsx.writeBuffer()));
    const url = await uploadTranslatedFile(portcoId, fileId, outputBuffer, fileName);

    return {
      translatedFileUrl: url,
      sheetsProcessed: workbook.worksheets.length,
      cellsTranslated: 0,
      sourceLanguage: "en",
    };
  }

  // 4. Load prompt and translate in batches
  const systemPrompt = await buildExcelTranslationPrompt();
  const batches = batchCells(cells);

  let totalTranslated = 0;

  for (const batch of batches) {
    try {
      const translations = await translateBatch(batch, systemPrompt);

      // 5. Write translations back to cells
      for (let i = 0; i < batch.length; i++) {
        const cell = batch[i];
        const translated = translations.get(i);
        if (translated) {
          const sheet = workbook.getWorksheet(cell.sheetIndex);
          if (sheet) {
            const wsCell = sheet.getCell(cell.row, cell.col);
            wsCell.value = translated;
            // Style is preserved — ExcelJS keeps the style object on the cell
          }
          totalTranslated++;
        }
      }
    } catch (error) {
      console.error("Excel translation batch failed:", error);
      throw new Error(
        `Translation batch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // 6. Translate sheet names
  await translateSheetNames(workbook, systemPrompt);

  // 7. Export and upload
  const fileName = `translated_${Date.now()}.xlsx`;
  const outputBuffer = Buffer.from(new Uint8Array(await workbook.xlsx.writeBuffer()));
  const url = await uploadTranslatedFile(portcoId, fileId, outputBuffer, fileName);

  return {
    translatedFileUrl: url,
    sheetsProcessed: workbook.worksheets.length,
    cellsTranslated: totalTranslated,
    sourceLanguage: "ja",
  };
}
