import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SCORING_DIMENSIONS,
  SCORE_LABELS,
  calculateWeightedScore,
} from "@/lib/scoring/rubric";

interface ScoringBreakdownProps {
  scores: Record<string, number>;
  rationales?: Record<string, string>;
  overallScore?: number | null;
}

import { useMemo } from "react";

function ScoreBar({ score, maxScore = 5 }: { score: number; maxScore?: number }) {
  const pct = (score / maxScore) * 100;
  const color =
    score >= 4 ? "bg-green-500" :
    score >= 3 ? "bg-yellow-500" :
    score >= 2 ? "bg-orange-500" :
    "bg-red-500";
  const barStyle = useMemo(() => ({ width: `${pct}%` }), [pct]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${color} transition-all`} style={barStyle} />
      </div>
      <span className="text-sm font-medium w-8 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

export function ScoringBreakdown({ scores, rationales, overallScore }: ScoringBreakdownProps) {
  const { weighted, recommendation, description } = calculateWeightedScore(scores);
  const displayScore = overallScore ?? weighted;

  const badgeColor =
    displayScore >= 4.0 ? "bg-green-100 text-green-800 border-green-200" :
    displayScore >= 3.5 ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
    displayScore >= 3.0 ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
    displayScore >= 2.5 ? "bg-orange-100 text-orange-800 border-orange-200" :
    "bg-red-100 text-red-800 border-red-200";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">IM Scoring Breakdown</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`${badgeColor} text-sm`}>
              {displayScore.toFixed(2)} / 5.00
            </Badge>
            <Badge variant="outline" className="text-xs">
              {recommendation}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {SCORING_DIMENSIONS.map((dim) => {
          const score = scores[dim.id];
          if (score === undefined) return null;
          return (
            <div key={dim.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{dim.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {SCORE_LABELS[Math.round(score)]} ({(dim.weight * 100).toFixed(0)}%)
                </span>
              </div>
              <ScoreBar score={score} />
              {rationales?.[dim.id] && (
                <p className="text-[11px] text-muted-foreground mt-1">{rationales[dim.id]}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
