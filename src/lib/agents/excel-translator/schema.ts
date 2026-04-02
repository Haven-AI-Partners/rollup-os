import { z } from "zod";

// ── Excel Translation Agent schemas ──

export const excelTranslationInputSchema = z.object({
  fileId: z.string().uuid(),
  portcoId: z.string().uuid(),
  gdriveFileId: z.string(),
});

export type ExcelTranslationInput = z.infer<typeof excelTranslationInputSchema>;

/** A single cell to translate, sent to the LLM in a batch */
export const cellEntrySchema = z.object({
  id: z.number(),
  original: z.string(),
});

/** LLM response: array of translated cells in the same order */
export const cellTranslationResultSchema = z.object({
  cells: z.array(
    z.object({
      id: z.number(),
      translated: z.string(),
    }),
  ),
});

export type CellTranslationResult = z.infer<typeof cellTranslationResultSchema>;

/** Final result of the Excel translation pipeline */
export interface ExcelTranslationResult {
  translatedFileUrl: string;
  sheetsProcessed: number;
  cellsTranslated: number;
  sourceLanguage: string;
}

/** Internal representation of a translatable cell */
export interface TranslatableCell {
  sheetIndex: number;
  row: number;
  col: number;
  value: string;
}
