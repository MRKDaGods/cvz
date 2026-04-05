"use client";

import {
  Briefcase,
  Calendar,
  Code,
  TrendingUp,
  ArrowRightLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FieldAnalysis } from "@/stores/cv-store";

const SENIORITY_COLORS: Record<string, string> = {
  intern: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  junior: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  mid: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  senior: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  lead: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  principal: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  executive: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const TRAJECTORY_LABELS: Record<string, { label: string; color: string }> = {
  ascending: { label: "Ascending", color: "text-green-600 dark:text-green-400" },
  lateral: { label: "Lateral", color: "text-blue-600 dark:text-blue-400" },
  pivoting: { label: "Pivoting", color: "text-amber-600 dark:text-amber-400" },
  mixed: { label: "Mixed", color: "text-purple-600 dark:text-purple-400" },
};

export function FieldAnalysisCard({ data }: { data: FieldAnalysis }) {
  const trajectory = TRAJECTORY_LABELS[data.careerTrajectory] ?? TRAJECTORY_LABELS.ascending;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-6">
          {/* Seniority + Domain */}
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Domain & Level</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-medium">{data.domain}</span>
                <Badge
                  className={SENIORITY_COLORS[data.seniority] ?? ""}
                >
                  {data.seniority}
                </Badge>
              </div>
            </div>
          </div>

          {/* Years */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Experience</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {data.professionalYears != null ? (
                  <span className="text-sm font-medium">
                    {data.professionalYears}yr professional
                  </span>
                ) : data.yearsOfExperience != null ? (
                  <span className="text-sm font-medium">
                    {data.yearsOfExperience}yr total
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Unknown</span>
                )}
                {data.internshipYears != null && data.internshipYears > 0 && (
                  <span className="text-xs text-muted-foreground">
                    + {data.internshipYears}yr internships
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Trajectory */}
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Trajectory</p>
              <span className={`text-sm font-medium ${trajectory.color}`}>
                {trajectory.label}
              </span>
            </div>
          </div>

          {/* Flags */}
          {(data.isCareerChanger || data.hasMixedExperience) && (
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex gap-1.5">
                {data.isCareerChanger && (
                  <Badge variant="outline" className="text-xs">Career Changer</Badge>
                )}
                {data.hasMixedExperience && (
                  <Badge variant="outline" className="text-xs">Mixed Experience</Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Skills */}
        {data.primarySkills.length > 0 && (
          <div className="mt-3 flex items-start gap-2">
            <Code className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1.5">
              {data.primarySkills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
