import { Circle, AlertTriangle, HelpCircle } from "lucide-react";
import type { ThesisNode } from "./thesis-tree";

function collectIssues(nodes: ThesisNode[]): { partial: ThesisNode[]; unknown: ThesisNode[]; risks: ThesisNode[] } {
  const partial: ThesisNode[] = [];
  const unknown: ThesisNode[] = [];
  const risks: ThesisNode[] = [];
  function walk(node: ThesisNode) {
    if (node.children.length === 0) {
      if (node.status === "risk") risks.push(node);
      else if (node.status === "partial") partial.push(node);
      else if (node.status === "unknown") unknown.push(node);
    }
    for (const child of node.children) walk(child);
  }
  for (const root of nodes) walk(root);
  return { partial, unknown, risks };
}

export function IssuesPanel({ roots }: { roots: ThesisNode[] }) {
  const { partial, unknown, risks } = collectIssues(roots);
  if (partial.length === 0 && unknown.length === 0 && risks.length === 0) return null;

  return (
    <div className="w-full md:w-72 shrink-0 space-y-4 md:overflow-y-auto md:h-[calc(100vh-200px)] md:min-h-[400px]">
      {risks.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
          <h3 className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="size-3.5" />
            Risks ({risks.length})
          </h3>
          <ul className="space-y-2">
            {risks.map((n) => (
              <li key={n.id} className="text-xs">
                <p className="font-medium text-red-900">{n.label}</p>
                {n.value && <p className="text-red-700/80 mt-0.5">{n.value}</p>}
                {n.notes && <p className="text-red-600/60 mt-0.5 italic">{n.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {partial.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <h3 className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-2">
            <Circle className="size-3.5" />
            Partial ({partial.length})
          </h3>
          <ul className="space-y-2">
            {partial.map((n) => (
              <li key={n.id} className="text-xs">
                <p className="font-medium text-amber-900">{n.label}</p>
                {n.notes && <p className="text-amber-700/70 mt-0.5">{n.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {unknown.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
          <h3 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
            <HelpCircle className="size-3.5" />
            Unknown ({unknown.length})
          </h3>
          <ul className="space-y-2">
            {unknown.map((n) => (
              <li key={n.id} className="text-xs">
                <p className="font-medium text-gray-800">{n.label}</p>
                {n.notes && <p className="text-gray-500 mt-0.5">{n.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
