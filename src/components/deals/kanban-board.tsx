"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  currency: string | null;
  status: string;
  source: string | null;
  kanbanPosition: number | null;
  aiScore: string | null;
  redFlagCount: number;
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
        .sort((a, b) => {
          const scoreA = a.aiScore ? Number(a.aiScore) : -1;
          const scoreB = b.aiScore ? Number(b.aiScore) : -1;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return (a.kanbanPosition ?? 0) - (b.kanbanPosition ?? 0);
        });
    }
    return grouped;
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
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

  const handleSelect = useCallback((dealId: string, metaKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (metaKey) {
        if (next.has(dealId)) {
          next.delete(dealId);
        } else {
          next.add(dealId);
        }
      } else {
        if (next.has(dealId) && next.size === 1) {
          next.clear();
        } else {
          next.clear();
          next.add(dealId);
        }
      }
      return next;
    });
  }, []);

  // Determine which IDs are being dragged (the active + any other selected in the same column)
  const getDraggedIds = useCallback((): string[] => {
    if (!activeId) return [];
    if (!selectedIds.has(activeId)) return [activeId];
    // All selected that are in the same stage as the active card
    const activeStage = findStageForDeal(activeId);
    if (!activeStage) return [activeId];
    return [activeId, ...Array.from(selectedIds).filter(
      (id) => id !== activeId && findStageForDeal(id) === activeStage
    )];
  }, [activeId, selectedIds, findStageForDeal]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    // If dragging an unselected card, clear selection
    if (!selectedIds.has(id)) {
      setSelectedIds(new Set());
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeStageId = findStageForDeal(active.id as string);
    let overStageId = stages.find((s) => s.id === over.id)?.id ?? null;
    if (!overStageId) {
      overStageId = findStageForDeal(over.id as string);
    }

    if (!activeStageId || !overStageId || activeStageId === overStageId) return;

    const draggedIds = getDraggedIds();

    setDealsByStage((prev) => {
      const movedDeals = prev[activeStageId].filter((d) => draggedIds.includes(d.id));
      if (movedDeals.length === 0) return prev;

      return {
        ...prev,
        [activeStageId]: prev[activeStageId].filter((d) => !draggedIds.includes(d.id)),
        [overStageId]: [
          ...prev[overStageId],
          ...movedDeals.map((d) => ({ ...d, stageId: overStageId })),
        ],
      };
    });
  };

  const handleDragEnd = async () => {
    const draggedIds = getDraggedIds();
    setActiveId(null);

    if (draggedIds.length === 0) return;

    const newStageId = findStageForDeal(draggedIds[0]);
    if (!newStageId) return;

    // Persist all dragged deals to their new stage
    await Promise.all(
      draggedIds.map((id) => {
        const position = dealsByStage[newStageId].findIndex((d) => d.id === id);
        return moveDealToStage(id, newStageId, position, portcoSlug);
      })
    );

    setSelectedIds(new Set());
  };

  const draggedIds = getDraggedIds();
  const dragCount = draggedIds.length;

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
            selectedIds={selectedIds}
            onSelect={handleSelect}
          />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? (
          <div className="relative">
            <Card className="w-72 rotate-2 shadow-lg">
              <CardContent className="p-3">
                <p className="text-sm font-medium">{activeDeal.companyName}</p>
              </CardContent>
            </Card>
            {dragCount > 1 && (
              <Badge className="absolute -top-2 -right-2 size-6 rounded-full p-0 flex items-center justify-center text-xs">
                {dragCount}
              </Badge>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
