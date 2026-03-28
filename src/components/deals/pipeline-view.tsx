"use client";

import { useState } from "react";
import { KanbanBoard } from "./kanban-board";
import { DealListView } from "./deal-list-view";
import { LayoutGrid, List } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  phase: string;
  position: number;
  color: string | null;
  portcoId: string;
}

interface Deal {
  id: string;
  companyName: string;
  description: string | null;
  industry: string | null;
  location: string | null;
  askingPrice: string | null;
  revenue: string | null;
  ebitda: string | null;
  currency: string | null;
  status: string;
  source: string | null;
  stageId: string;
  portcoId: string;
  kanbanPosition: number | null;
  aiScore: string | null;
  redFlagCount: number;
  createdAt: Date;
}

interface PipelineViewProps {
  stages: Stage[];
  deals: Deal[];
  portcoSlug: string;
}

export function PipelineView({ stages, deals, portcoSlug }: PipelineViewProps) {
  const [view, setView] = useState<"kanban" | "list">("list");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-md border p-0.5 w-fit">
        <button
          onClick={() => setView("kanban")}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition-colors ${
            view === "kanban"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="size-4" />
          Board
        </button>
        <button
          onClick={() => setView("list")}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition-colors ${
            view === "list"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <List className="size-4" />
          List
        </button>
      </div>

      {view === "kanban" ? (
        <KanbanBoard
          stages={stages}
          initialDeals={deals}
          portcoSlug={portcoSlug}
        />
      ) : (
        <DealListView
          deals={deals}
          stages={stages}
          portcoSlug={portcoSlug}
        />
      )}
    </div>
  );
}
