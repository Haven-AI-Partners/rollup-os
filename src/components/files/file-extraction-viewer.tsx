"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Eye, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileExtraction } from "@/lib/actions/file-extractions";

interface ExtractedPage {
  pageNumber: number;
  content: string;
  hasDiagram?: boolean;
}

interface DiagramImage {
  pageNumber: number;
  base64: string;
  mimeType: string;
  description: string;
}

interface TranslatedPage {
  pageNumber: number;
  originalContent: string;
  translatedContent: string;
}

interface ContentExtraction {
  pages: ExtractedPage[];
  metadata: {
    totalPages: number;
    documentLanguage: string;
    documentTitle: string | null;
  };
}

interface Translation {
  pages: TranslatedPage[];
  sourceLanguage: string;
  targetLanguage: string;
}

/** Extract the first H1 or H2 heading from a page's content */
function getFirstHeading(content: string): string | null {
  const match = content.match(/^#{1,2}\s+(.+)/m);
  return match ? match[1].trim() : null;
}

interface FileExtractionViewerProps {
  fileId: string;
  fileName: string;
}

export function FileExtractionViewer({ fileId, fileName }: FileExtractionViewerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contentExtraction, setContentExtraction] = useState<ContentExtraction | null>(null);
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [diagramImages, setDiagramImages] = useState<DiagramImage[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showDiagramImages, setShowDiagramImages] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);

  const isTranslated = translation != null && translation.sourceLanguage !== "en";

  const handleOpen = useCallback(async () => {
    setOpen(true);
    if (contentExtraction) return;

    setLoading(true);
    try {
      const extraction = await getFileExtraction(fileId);
      if (extraction) {
        setContentExtraction(extraction.contentExtraction as ContentExtraction);
        setTranslation(extraction.translation as Translation | null);
        setDiagramImages((extraction.diagramImages as DiagramImage[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [fileId, contentExtraction]);

  const pages = contentExtraction?.pages ?? [];

  const getPageContent = useCallback((pageNumber: number): string => {
    if (isTranslated && !showOriginal && translation) {
      const translatedPage = translation.pages.find((p) => p.pageNumber === pageNumber);
      return translatedPage?.translatedContent ?? "";
    }
    const extractedPage = pages.find((p) => p.pageNumber === pageNumber);
    return extractedPage?.content ?? "";
  }, [isTranslated, showOriginal, translation, pages]);

  const getDiagramImage = useCallback((pageNumber: number): DiagramImage | undefined => {
    return diagramImages.find((d) => d.pageNumber === pageNumber);
  }, [diagramImages]);

  const hasDiagramImages = diagramImages.length > 0;

  // Build page labels from first heading
  const pageLabels = useMemo(() => {
    const labels = new Map<number, string>();
    for (const page of pages) {
      const heading = getFirstHeading(getPageContent(page.pageNumber));
      if (heading) labels.set(page.pageNumber, heading);
    }
    return labels;
  }, [pages, getPageContent]);

  const scrollToPage = useCallback((pageNumber: number) => {
    const el = document.getElementById(`page-${pageNumber}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActivePage(pageNumber);
    }
  }, []);

  // Track active page on scroll
  useEffect(() => {
    if (!open || !contentExtraction) return;

    const scrollEl = contentRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const pages = contentExtraction.pages;
      for (let i = pages.length - 1; i >= 0; i--) {
        const el = document.getElementById(`page-${pages[i].pageNumber}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const containerRect = scrollEl.getBoundingClientRect();
          if (rect.top <= containerRect.top + 100) {
            setActivePage(pages[i].pageNumber);
            break;
          }
        }
      }
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [open, contentExtraction]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={handleOpen}
        title="View extracted content"
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
                  {contentExtraction && (
                    <>
                      {contentExtraction.metadata.totalPages} pages
                      {isTranslated && (
                        <>
                          {" "}· {translation.sourceLanguage.toUpperCase()} → {translation.targetLanguage.toUpperCase()}
                        </>
                      )}
                    </>
                  )}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasDiagramImages && (
                  <Button
                    variant={showDiagramImages ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setShowDiagramImages(!showDiagramImages)}
                    title={showDiagramImages ? "Hide page images for diagrams" : "Show page images for diagrams"}
                  >
                    <ImageIcon className="size-3" />
                    Diagrams
                  </Button>
                )}
                {isTranslated && (
                  <div className="flex items-center gap-1 rounded-lg border p-1">
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
            </div>
          </DialogHeader>

          {/* Content area */}
          <div className="flex flex-1 min-h-0">
            {/* Page sidebar */}
            {contentExtraction && pages.length > 1 && (
              <div className="w-52 shrink-0 border-r">
                <ScrollArea className="h-full">
                  <div className="flex flex-col gap-0.5 p-2">
                    {pages.map((page) => {
                      const label = pageLabels.get(page.pageNumber);
                      const isActive = activePage === page.pageNumber;
                      return (
                        <button
                          key={page.pageNumber}
                          onClick={() => scrollToPage(page.pageNumber)}
                          className={cn(
                            "w-full rounded px-2 py-1.5 text-left transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <span className="text-[10px] font-medium">p.{page.pageNumber}</span>
                          {label && (
                            <span className="ml-1.5 text-xs truncate block">{label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 min-w-0 min-h-0 overflow-auto" ref={contentRef}>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-sm text-muted-foreground">Loading extraction...</p>
                </div>
              ) : !contentExtraction ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-sm text-muted-foreground">No extraction data found.</p>
                </div>
              ) : (
                <div className="p-6">
                  {pages.map((page, index) => {
                    const diagramImage = getDiagramImage(page.pageNumber);
                    return (
                      <div key={page.pageNumber}>
                        <div id={`page-${page.pageNumber}`} className="scroll-mt-4">
                          {index > 0 && (
                            <div className="flex items-center gap-3 my-6">
                              <Separator className="flex-1" />
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                Page {page.pageNumber}
                              </Badge>
                              <Separator className="flex-1" />
                            </div>
                          )}
                          {showDiagramImages && diagramImage && (
                            <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                              <p className="mb-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <ImageIcon className="size-3" />
                                {diagramImage.description}
                              </p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`data:${diagramImage.mimeType};base64,${diagramImage.base64}`}
                                alt={diagramImage.description}
                                className="max-w-full rounded border"
                              />
                            </div>
                          )}
                          <MarkdownRenderer
                            content={getPageContent(page.pageNumber)}
                            className="[&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1"
                            wrapTables
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
