"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Wrap tables in a horizontally scrollable container */
  wrapTables?: boolean;
}

/**
 * Fix malformed markdown table alignment rows.
 * When the header row has N columns but the alignment row has fewer separators,
 * pad the alignment row to match.
 */
/**
 * Fix common markdown table issues:
 * 1. Alignment rows with fewer columns than the header
 * 2. Missing blank line before table header (required for markdown parsing)
 */
function fixTables(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this is a table header row (starts with |, has content, followed by alignment row)
    if (
      trimmed.startsWith("|") &&
      i + 1 < lines.length &&
      /^\|[\s:|-]+\|$/.test(lines[i + 1].trim()) &&
      i > 0 &&
      result.length > 0 &&
      result[result.length - 1].trim() !== ""
    ) {
      // Insert blank line before table if missing
      result.push("");
    }

    // Fix alignment rows with fewer columns than header
    if (/^\|[\s:|-]+\|$/.test(trimmed) && i > 0) {
      const headerLine = lines[i - 1].trim();
      const headerCols = headerLine.split("|").filter(Boolean).length;
      const alignCols = trimmed.split("|").filter(Boolean).length;

      if (alignCols < headerCols) {
        const alignCells = Array(headerCols).fill("---");
        result.push(`| ${alignCells.join(" | ")} |`);
        continue;
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

export function MarkdownRenderer({ content, className, wrapTables }: MarkdownRendererProps) {
  const fixedContent = fixTables(content);

  return (
    <div className={cn(
      "prose prose-sm max-w-none dark:prose-invert",
      "break-words [overflow-wrap:anywhere]",
      "[&_pre]:overflow-x-auto [&_pre]:max-w-full [&_img]:max-w-full",
      className,
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={wrapTables ? {
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props}>{children}</table>
            </div>
          ),
        } : undefined}
      >
        {fixedContent}
      </ReactMarkdown>
    </div>
  );
}
