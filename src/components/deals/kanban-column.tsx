"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { DealCard } from "./deal-card";

interface KanbanColumnProps {
  stage: {
    id: string;
    name: string;
    color: string | null;
    phase: string;
  };
  deals: Array<{
    id: string;
    companyName: string;
    description: string | null;
    industry: string | null;
    location: string | null;
    askingPrice: string | null;
    revenue: string | null;
    ebitda: string | null;
    status: string;
    source: string | null;
    aiScore: string | null;
    redFlagCount: number;
  }>;
  portcoSlug: string;
  selectedIds: Set<string>;
  onSelect: (dealId: string, metaKey: boolean) => void;
}

export function KanbanColumn({ stage, deals, portcoSlug, selectedIds, onSelect }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 ${
        isOver ? "ring-2 ring-primary/50" : ""
      }`}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div
          className="size-2.5 rounded-full"
          style={{ backgroundColor: stage.color ?? "#94a3b8" }}
        />
        <h3 className="text-sm font-medium">{stage.name}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {deals.length}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 200px)" }}>
        <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[40px]">
          <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                portcoSlug={portcoSlug}
                isSelected={selectedIds.has(deal.id)}
                onSelect={onSelect}
              />
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}
