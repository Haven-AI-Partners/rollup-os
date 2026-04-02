"use client";

import { useEffect, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

let mermaidIdCounter = 0;

/**
 * Sanitize mermaid chart syntax to handle common issues from LLM output:
 * - Wrap node labels containing CJK/special chars in quotes
 */
/**
 * Sanitize mermaid chart: quote all node labels to avoid parse errors
 * from special characters (parentheses, CJK, etc.).
 */
function sanitizeMermaidChart(chart: string): string {
  return chart
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      // Skip directives, keywords, comments, empty lines
      if (
        trimmed === "" ||
        /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)\s/i.test(trimmed) ||
        /^(subgraph|end)\b/i.test(trimmed) ||
        /^%%/.test(trimmed)
      ) {
        return line;
      }

      // Quote labels in square brackets: A[label] → A["label"]
      let result = line.replace(
        /([\w-]+)\[([^\]"]+)\]/g,
        (_match, id, label) => {
          const escaped = label.replace(/"/g, "&quot;").replace(/\(/g, "（").replace(/\)/g, "）");
          return `${id}["${escaped}"]`;
        },
      );

      // Convert round bracket labels to quoted square: A(label) → A["label"]
      result = result.replace(
        /([\w-]+)\(([^)]+)\)/g,
        (_match, id, label) => {
          if (/^(click|style|class|linkStyle)$/.test(id)) return _match;
          const escaped = label.replace(/"/g, "&quot;").replace(/\(/g, "（").replace(/\)/g, "）");
          return `${id}["${escaped}"]`;
        },
      );

      return result;
    })
    .join("\n");
}

/**
 * Renders a Mermaid diagram from a code string.
 */
export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "loose",
          fontFamily: "inherit",
        });

        const sanitized = sanitizeMermaidChart(chart);
        const id = `mermaid-${++mermaidIdCounter}`;

        // Render into a detached element
        const el = document.createElement("div");
        el.id = id;
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);

        try {
          const { svg: rendered } = await mermaid.render(id, sanitized);
          if (!cancelled) setSvg(rendered);
        } finally {
          el.remove();
        }
      } catch (err) {
        console.error("Mermaid render error:", err);
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to render");
      }
    }

    render();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className={className}>
        <pre className="rounded-md border bg-muted p-3 text-xs text-muted-foreground overflow-x-auto">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  if (svg) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return null;
}
