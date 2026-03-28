"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface FileTypeBadgeProps {
  label: string;
  className?: string;
  classificationConfidence: string | null;
  classifiedBy: string | null;
}

export function FileTypeBadge({
  label,
  className,
  classificationConfidence,
  classifiedBy,
}: FileTypeBadgeProps) {
  if (classifiedBy === "auto" && classificationConfidence) {
    const pct = Math.round(Number(classificationConfidence) * 100);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`text-[10px] shrink-0 cursor-default ${className ?? ""}`}>
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Confidence score: {pct}%</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Badge className={`text-[10px] shrink-0 ${className ?? ""}`}>
      {label}
    </Badge>
  );
}
