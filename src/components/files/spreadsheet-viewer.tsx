"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSpreadsheetData } from "@/lib/actions/spreadsheet";
import type { SpreadsheetData, SpreadsheetSheet } from "@/lib/actions/spreadsheet";

interface SpreadsheetViewerProps {
  fileId: string;
  fileName: string;
}

function SheetTable({ sheet }: { sheet: SpreadsheetSheet }) {
  if (sheet.headers.length === 0 && sheet.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Empty sheet
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-2 py-1.5 text-left text-[10px] text-muted-foreground font-medium w-8">
              #
            </th>
            {sheet.headers.map((header, i) => (
              <th
                key={i}
                className="px-2 py-1.5 text-left font-semibold whitespace-nowrap border-r last:border-r-0"
              >
                {header || <span className="text-muted-foreground">—</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-2 py-1 text-[10px] text-muted-foreground tabular-nums">
                {rowIdx + 2}
              </td>
              {Array.from({ length: sheet.columnCount }, (_, colIdx) => {
                const cell = row[colIdx];
                return (
                  <td
                    key={colIdx}
                    className={cn(
                      "px-2 py-1 whitespace-pre-wrap border-r last:border-r-0 max-w-[300px]",
                      cell?.isFormula && "text-blue-600 italic",
                    )}
                  >
                    {cell?.value || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {sheet.truncated && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-t text-xs text-amber-700">
          <AlertTriangle className="size-3.5 shrink-0" />
          Showing first 500 of {sheet.totalRows} rows
        </div>
      )}
    </div>
  );
}

export function SpreadsheetViewer({ fileId, fileName }: SpreadsheetViewerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [original, setOriginal] = useState<SpreadsheetData | null>(null);
  const [translated, setTranslated] = useState<SpreadsheetData | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  const isTranslated = translated != null;
  const activeData = showOriginal || !isTranslated ? original : translated;
  const sheets = activeData?.sheets ?? [];
  const activeSheet = sheets[activeSheetIdx] ?? null;

  const handleOpen = useCallback(async () => {
    setOpen(true);
    if (original) return;

    setLoading(true);
    try {
      const result = await getSpreadsheetData(fileId);
      if (result) {
        setOriginal(result.original);
        setTranslated(result.translated);
      }
    } finally {
      setLoading(false);
    }
  }, [fileId, original]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={handleOpen}
        title="Preview spreadsheet"
      >
        <Eye className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="h-[90dvh] !max-w-[90vw] flex flex-col gap-0 p-0 overflow-hidden"
          showCloseButton
        >
          {/* Header */}
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <DialogTitle className="truncate">{fileName}</DialogTitle>
                <DialogDescription>
                  {original && (
                    <>
                      {sheets.length} sheet{sheets.length !== 1 ? "s" : ""}
                      {activeSheet && ` · ${activeSheet.totalRows + 1} rows`}
                    </>
                  )}
                </DialogDescription>
              </div>
              {isTranslated && (
                <div className="flex items-center gap-1 rounded-lg border p-1 shrink-0">
                  <Button
                    variant={showOriginal ? "ghost" : "secondary"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowOriginal(false)}
                  >
                    Translated
                  </Button>
                  <Button
                    variant={showOriginal ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowOriginal(true)}
                  >
                    Original
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Content area */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Sheet tabs */}
            {sheets.length > 1 && (
              <div className="shrink-0 border-b bg-muted/30 px-4">
                <div className="flex gap-0 overflow-x-auto">
                  {sheets.map((sheet, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSheetIdx(idx)}
                      className={cn(
                        "px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors",
                        idx === activeSheetIdx
                          ? "border-primary text-foreground font-medium"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
                      )}
                    >
                      {sheet.name}
                      <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">
                        {sheet.totalRows + 1}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Table content */}
            <div className="flex-1 min-h-0 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-sm text-muted-foreground">Loading spreadsheet...</p>
                </div>
              ) : !original ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-sm text-muted-foreground">
                    Could not load spreadsheet data.
                  </p>
                </div>
              ) : activeSheet ? (
                <SheetTable sheet={activeSheet} />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
