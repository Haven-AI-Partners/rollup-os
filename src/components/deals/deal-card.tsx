"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Star, AlertTriangle } from "lucide-react";

interface DealCardProps {
  deal: {
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
  };
  portcoSlug: string;
}

export function DealCard({ deal, portcoSlug }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="cursor-default hover:border-primary/50 transition-colors">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <button
              className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
            <div className="flex-1 min-w-0">
              <Link
                href={`/${portcoSlug}/pipeline/${deal.id}/overview`}
                className="text-sm font-medium hover:underline line-clamp-1"
              >
                {deal.companyName}
              </Link>
              {deal.description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {deal.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {deal.industry?.split(/[,、・／/()（）]+/).map((tag) => tag.trim()).filter(Boolean).map((tag, i) => (
                  <Badge key={`ind-${i}`} variant="outline" className="text-[10px] px-1.5 py-0 max-w-[120px] block truncate text-left" title={tag}>
                    {tag}
                  </Badge>
                ))}
                {deal.location && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 max-w-[120px] block truncate text-left" title={deal.location}>
                    {deal.location}
                  </Badge>
                )}
              </div>
              {(deal.aiScore || deal.redFlagCount > 0 || deal.revenue || deal.ebitda) && (
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                  {deal.aiScore && (
                    <span className="flex items-center gap-0.5 font-medium text-foreground">
                      <Star className="size-3 text-amber-500 fill-amber-500" />
                      {Number(deal.aiScore).toFixed(1)}/5
                    </span>
                  )}
                  {deal.redFlagCount > 0 && (
                    <span className="flex items-center gap-0.5 text-red-600">
                      <AlertTriangle className="size-3" />
                      {deal.redFlagCount}
                    </span>
                  )}
                  {deal.revenue && <span>Rev: ${Number(deal.revenue).toLocaleString()}</span>}
                  {deal.ebitda && <span>EBITDA: ${Number(deal.ebitda).toLocaleString()}</span>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
