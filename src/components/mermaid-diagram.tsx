"use client";

import { useEffect, useRef, useState, useId } from "react";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

/**
 * Renders a Mermaid diagram from a code string.
 * Uses dynamic import to avoid SSR issues with mermaid.
 */
export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uniqueId = useId().replace(/:/g, "-");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
          fontFamily: "inherit",
        });

        const { svg: rendered } = await mermaid.render(
          `mermaid-${uniqueId}`,
          chart,
        );

        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setSvg(null);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chart, uniqueId]);

  if (error) {
    return (
      <div className={className}>
        <pre className="rounded-md border bg-muted p-3 text-xs text-muted-foreground overflow-x-auto">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
