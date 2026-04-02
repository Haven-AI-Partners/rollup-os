"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { MermaidDiagram } from "@/components/mermaid-diagram";

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
function fixTableAlignmentRows(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

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
  const fixedContent = fixTableAlignmentRows(content);

  return (
    <div className={cn(
      "prose prose-sm max-w-none dark:prose-invert",
      "break-words [overflow-wrap:anywhere]",
      "[&_pre]:overflow-x-auto [&_pre]:max-w-full [&_img]:max-w-full",
      className,
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ...(wrapTables ? {
            table: ({ children, ...props }) => (
              <div className="overflow-x-auto">
                <table {...props}>{children}</table>
              </div>
            ),
          } : {}),
          pre: ({ children, ...props }) => {
            // Check if this pre wraps a mermaid code block — if so, render
            // the MermaidDiagram directly without the <pre> wrapper.
            const child = Array.isArray(children) ? children[0] : children;
            if (
              child &&
              typeof child === "object" &&
              "props" in child &&
              /language-mermaid/.test(child.props?.className ?? "")
            ) {
              return (
                <MermaidDiagram
                  chart={String(child.props.children).trim()}
                  className="my-4 overflow-x-auto"
                />
              );
            }
            return <pre {...props}>{children}</pre>;
          },
        }}
      >
        {fixedContent}
      </ReactMarkdown>
    </div>
  );
}
