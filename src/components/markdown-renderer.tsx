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

export function MarkdownRenderer({ content, className, wrapTables }: MarkdownRendererProps) {
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
