"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Scores } from "@/stores/cv-store";

interface ScoreChartProps {
  scores: Scores;
}

function ScoreRow({
  label,
  before,
  after,
}: {
  label: string;
  before: number;
  after: number;
}) {
  const improvement = after - before;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="text-muted-foreground">{before}</span>
          <span className="text-muted-foreground mx-1">&rarr;</span>
          <span className="font-medium text-foreground">{after}</span>
          {improvement > 0 && (
            <span className="ml-1 text-green-600 dark:text-green-400 text-[11px]">
              +{improvement}
            </span>
          )}
        </span>
      </div>
      <Progress value={after} className="h-1.5" />
    </div>
  );
}

export function ScoreChart({ scores }: ScoreChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Scores</CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] font-normal">{scores.tierBefore}</Badge>
            <span>&rarr;</span>
            <Badge className="text-[10px]">{scores.tierAfter}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <ScoreRow label="ATS Compatibility" before={scores.atsBefore} after={scores.atsAfter} />
        <ScoreRow label="Job Fit" before={scores.jobFitBefore} after={scores.jobFitAfter} />
        <ScoreRow label="Content Quality" before={scores.qualityBefore} after={scores.qualityAfter} />
      </CardContent>
    </Card>
  );
}
