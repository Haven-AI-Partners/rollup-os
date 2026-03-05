"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { KanbanColumn } from "./kanban-column";
import { moveDealToStage } from "@/lib/actions/deals";

interface Stage {
  id: string;
  name: string;
  color: string | null;
  phase: string;
  position: number;
}

interface Deal {
  id: string;
  stageId: string;
  companyName: string;
  description: string | null;
  industry: string | null;
  location: string | null;
  askingPrice: string | null;
  revenue: string | null;
  ebitda: string | null;
  status: string;
  source: string | null;
  kanbanPosition: number;
}

interface KanbanBoardProps {
  stages: Stage[];
  initialDeals: Deal[];
  portcoSlug: string;
}

export function KanbanBoard({ stages, initialDeals, portcoSlug }: KanbanBoardProps) {
  const [dealsByStage, setDealsByStage] = useState<Record<string, Deal[]>>(() => {
    const grouped: Record<string, Deal[]> = {};
    for (const stage of stages) {
      grouped[stage.id] = initialDeals
        .filter((d) => d.stageId === stage.id)
        .sort((a, b) => a.kanbanPosition - b.kanbanPosition);
    }
    return grouped;
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeDeal = activeId
    ? Object.values(dealsByStage).flat().find((d) => d.id === activeId)
    : null;

  const findStageForDeal = useCallback(
    (dealId: string): string | null => {
      for (const [stageId, stageDeals] of Object.entries(dealsByStage)) {
        if (stageDeals.some((d) => d.id === dealId)) return stageId;
      }
      return null;
    },
    [dealsByStage]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeStageId = findStageForDeal(active.id as string);
    // Determine if we're over a column or another deal
    let overStageId = stages.find((s) => s.id === over.id)?.id ?? null;
    if (!overStageId) {
      overStageId = findStageForDeal(over.id as string);
    }

    if (!activeStageId || !overStageId || activeStageId === overStageId) return;

    setDealsByStage((prev) => {
      const deal = prev[activeStageId].find((d) => d.id === active.id);
      if (!deal) return prev;

      return {
        ...prev,
        [activeStageId]: prev[activeStageId].filter((d) => d.id !== active.id),
        [overStageId]: [...prev[overStageId], { ...deal, stageId: overStageId }],
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active } = event;
    setActiveId(null);

    const newStageId = findStageForDeal(active.id as string);
    if (!newStageId) return;

    const position = dealsByStage[newStageId].findIndex((d) => d.id === active.id);
    await moveDealToStage(active.id as string, newStageId, position, portcoSlug);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={dealsByStage[stage.id] ?? []}
            portcoSlug={portcoSlug}
          />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? (
          <Card className="w-72 rotate-2 shadow-lg">
            <CardContent className="p-3">
              <p className="text-sm font-medium">{activeDeal.companyName}</p>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
