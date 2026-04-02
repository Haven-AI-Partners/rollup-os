/**
 * Converts a file extraction record into a downloadable file representation.
 *
 * This is the extensibility point — currently handles markdown from page-based
 * extractions. Future file types (CSV, XLSX) can be added as new branches.
 */

interface ExtractedPage {
  pageNumber: number;
  content: string;
}

interface TranslatedPage {
  pageNumber: number;
  originalContent: string;
  translatedContent: string;
}

export interface ContentExtraction {
  pages: ExtractedPage[];
  metadata: {
    totalPages: number;
    documentLanguage: string;
    documentTitle: string | null;
  };
}

export interface Translation {
  pages: TranslatedPage[];
  sourceLanguage: string;
  targetLanguage: string;
}

export interface DownloadableFile {
  filename: string;
  content: string;
  mimeType: string;
}

/**
 * Convert extraction data to a downloadable file.
 * Uses translated content when available.
 */
export function extractionToDownloadable(
  fileName: string,
  contentExtraction: ContentExtraction,
  translation?: Translation | null,
): DownloadableFile {
  const useTranslation =
    translation != null && translation.sourceLanguage !== "en";

  const markdown = contentExtraction.pages
    .map((page) => {
      if (useTranslation) {
        const translated = translation.pages.find(
          (p) => p.pageNumber === page.pageNumber,
        );
        return translated?.translatedContent ?? page.content;
      }
      return page.content;
    })
    .join("\n\n---\n\n");

  const baseName = fileName.replace(/\.[^.]+$/, "");

  return {
    filename: `${baseName}.md`,
    content: markdown,
    mimeType: "text/markdown",
  };
}
