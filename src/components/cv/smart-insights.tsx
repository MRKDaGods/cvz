"use client";

import { useCallback, useState } from "react";
import {
  AlertTriangle,
  Brain,
  Loader2,
  MessageSquare,
  Search,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useModelStore } from "@/stores/model-store";
import { usePipelineStore } from "@/stores/pipeline-store";
import { ModelSelector } from "@/components/session/model-selector";
import { JsonViewerButton } from "@/components/session/json-viewer";
import { toStringArray } from "@/lib/utils";
import { toast } from "sonner";

// --- Types matching API response shapes ---

interface Gap {
  type: "employment" | "skill" | "section" | "experience";
  description: string;
  severity: "minor" | "moderate" | "critical";
  suggestion: string;
}

interface AtsResult {
  overallScore: number;
  keywordMatch: { score: number; matched: string[]; missing: string[] };
  formatScore: { score: number; issues: string[] };
  sectionDetection: { detected: string[]; missing: string[] };
  recommendations: string[];
}

interface InterviewResult {
  behavioral: { question: string; suggestedAnswer: string; basedOn: string }[];
  technical: { topic: string; why: string; prepTips: string }[];
  weaknesses: { area: string; howToAddress: string }[];
  talkingPoints: { point: string; impact: string }[];
}

// --- SmartInsights ---

interface SmartInsightsProps {
  sessionId: string;
}

function normalizeAtsResult(data: unknown): AtsResult | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const value = data as Record<string, unknown>;
  const keywordMatch = (value.keywordMatch as Record<string, unknown> | undefined) ?? {};
  const formatScore = (value.formatScore as Record<string, unknown> | undefined) ?? {};
  const sectionDetection = (value.sectionDetection as Record<string, unknown> | undefined) ?? {};

  if (typeof value.overallScore !== "number") {
    return null;
  }

  return {
    overallScore: value.overallScore,
    keywordMatch: {
      score: typeof keywordMatch.score === "number" ? keywordMatch.score : 0,
      matched: toStringArray(keywordMatch.matched),
      missing: toStringArray(keywordMatch.missing),
    },
    formatScore: {
      score: typeof formatScore.score === "number" ? formatScore.score : 0,
      issues: toStringArray(formatScore.issues),
    },
    sectionDetection: {
      detected: toStringArray(sectionDetection.detected),
      missing: toStringArray(sectionDetection.missing),
    },
    recommendations: toStringArray(value.recommendations),
  };
}

export function SmartInsights({ sessionId }: SmartInsightsProps) {
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [ats, setAts] = useState<AtsResult | null>(null);
  const [interview, setInterview] = useState<InterviewResult | null>(null);

  const [loadingGaps, setLoadingGaps] = useState(false);
  const [loadingAts, setLoadingAts] = useState(false);
  const [loadingInterview, setLoadingInterview] = useState(false);

  const getModel = useModelStore((s) => s.getModel);
  const setStageResponse = usePipelineStore((s) => s.setStageResponse);

  const fetchGaps = useCallback(async () => {
    setLoadingGaps(true);
    try {
      const res = await fetch("/api/smart/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, model: getModel("smart") }),
      });
      const data = await res.json();
      setStageResponse("gaps", JSON.stringify(data));
      setGaps(data.gaps ?? []);
    } catch {
      toast.error("Failed to analyze gaps");
    } finally {
      setLoadingGaps(false);
    }
  }, [sessionId, getModel]);

  const fetchAts = useCallback(async () => {
    setLoadingAts(true);
    try {
      const res = await fetch("/api/smart/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, model: getModel("smart") }),
      });
      const data = await res.json();
      const normalized = normalizeAtsResult(data);
      if (normalized) {
        setStageResponse("ats", JSON.stringify(normalized));
        setAts(normalized);
      } else {
        toast.error("ATS analysis returned unexpected format");
      }
    } catch {
      toast.error("Failed to run ATS analysis");
    } finally {
      setLoadingAts(false);
    }
  }, [sessionId, getModel]);

  const fetchInterview = useCallback(async () => {
    setLoadingInterview(true);
    try {
      const res = await fetch("/api/smart/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, model: getModel("smart") }),
      });
      const data = await res.json();
      if (data.behavioral) {
        setStageResponse("interview", JSON.stringify(data));
        setInterview(data);
      } else {
        toast.error("Interview tips returned unexpected format");
      }
    } catch {
      toast.error("Failed to generate interview tips");
    } finally {
      setLoadingInterview(false);
    }
  }, [sessionId, getModel]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Smart Insights
          </CardTitle>
          <ModelSelector stage="smart" />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="gaps">
          <TabsList className="w-full">
            <TabsTrigger value="gaps" className="flex-1">
              <Search className="mr-1.5 h-3.5 w-3.5" />
              Gaps
            </TabsTrigger>
            <TabsTrigger value="ats" className="flex-1">
              <Target className="mr-1.5 h-3.5 w-3.5" />
              ATS
            </TabsTrigger>
            <TabsTrigger value="interview" className="flex-1">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Interview
            </TabsTrigger>
          </TabsList>

          {/* Gap Analysis */}
          <TabsContent value="gaps" className="mt-4">
            {!gaps && !loadingGaps && (
              <EmptyPrompt
                text="Identify skill gaps, missing sections, and employment gaps."
                loading={false}
                onClick={fetchGaps}
                label="Analyze Gaps"
              />
            )}
            {loadingGaps && <LoadingState text="Analyzing gaps..." />}
            {gaps && (
              <div className="space-y-3">
                {gaps.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No significant gaps detected.
                  </p>
                )}
                {gaps.map((gap, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-3 space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={gap.severity} />
                      <Badge variant="outline" className="text-[10px]">
                        {gap.type}
                      </Badge>
                    </div>
                    <p className="text-sm">{gap.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {gap.suggestion}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <JsonViewerButton stage="gaps" />
                  <RefreshButton loading={loadingGaps} onClick={fetchGaps} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* ATS Score */}
          <TabsContent value="ats" className="mt-4">
            {!ats && !loadingAts && (
              <EmptyPrompt
                text="Simulate how an Applicant Tracking System would score your CV."
                loading={false}
                onClick={fetchAts}
                label="Run ATS Scan"
              />
            )}
            {loadingAts && <LoadingState text="Running ATS simulation..." />}
            {ats && (
              <div className="space-y-4">
                {/* Overall */}
                <div className="text-center py-2">
                  <span className="text-3xl font-bold">{ats.overallScore}</span>
                  <span className="text-muted-foreground text-sm">/100</span>
                </div>

                {/* Keyword Match */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Keyword Match</span>
                    <span>{ats.keywordMatch.score}%</span>
                  </div>
                  <Progress value={ats.keywordMatch.score} className="h-2" />
                  {ats.keywordMatch.missing.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ats.keywordMatch.missing.map((kw) => (
                        <Badge
                          key={kw}
                          variant="destructive"
                          className="text-[10px]"
                        >
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Format Score */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Format Compliance</span>
                    <span>{ats.formatScore.score}%</span>
                  </div>
                  <Progress value={ats.formatScore.score} className="h-2" />
                  {ats.formatScore.issues.length > 0 && (
                    <ul className="text-xs text-muted-foreground list-disc pl-4 mt-1 space-y-0.5">
                      {ats.formatScore.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Section Detection */}
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Sections Detected</span>
                  <div className="flex flex-wrap gap-1">
                    {ats.sectionDetection.detected.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                    {ats.sectionDetection.missing.map((s) => (
                      <Badge
                        key={s}
                        variant="destructive"
                        className="text-[10px]"
                      >
                        {s} (missing)
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {ats.recommendations.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium">Recommendations</span>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                      {ats.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <JsonViewerButton stage="ats" />
                  <RefreshButton loading={loadingAts} onClick={fetchAts} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Interview Prep */}
          <TabsContent value="interview" className="mt-4">
            {!interview && !loadingInterview && (
              <EmptyPrompt
                text="Generate personalized interview questions and prep tips based on your CV."
                loading={false}
                onClick={fetchInterview}
                label="Generate Tips"
              />
            )}
            {loadingInterview && (
              <LoadingState text="Preparing interview tips..." />
            )}
            {interview && (
              <div className="space-y-4">
                {/* Behavioral */}
                {interview.behavioral.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">
                      Behavioral Questions
                    </h4>
                    {interview.behavioral.map((q, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-1">
                        <p className="text-sm font-medium">{q.question}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.suggestedAnswer}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 italic">
                          Based on: {q.basedOn}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Technical */}
                {interview.technical.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Technical Topics</h4>
                    {interview.technical.map((t, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-1">
                        <p className="text-sm font-medium">{t.topic}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.why}
                        </p>
                        <p className="text-xs">
                          {t.prepTips}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Weaknesses */}
                {interview.weaknesses.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Potential Weaknesses
                    </h4>
                    {interview.weaknesses.map((w, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-1">
                        <p className="text-sm font-medium">{w.area}</p>
                        <p className="text-xs text-muted-foreground">
                          {w.howToAddress}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Talking Points */}
                {interview.talkingPoints.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Key Talking Points</h4>
                    {interview.talkingPoints.map((tp, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-1">
                        <p className="text-sm font-medium">{tp.point}</p>
                        <p className="text-xs text-muted-foreground">
                          {tp.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <JsonViewerButton stage="interview" />
                  <RefreshButton
                    loading={loadingInterview}
                    onClick={fetchInterview}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// --- Helpers ---

function SeverityBadge({ severity }: { severity: string }) {
  const variant =
    severity === "critical"
      ? "destructive"
      : severity === "moderate"
        ? "secondary"
        : "outline";
  return (
    <Badge variant={variant} className="text-[10px] capitalize">
      {severity}
    </Badge>
  );
}

function EmptyPrompt({
  text,
  loading,
  onClick,
  label,
}: {
  text: string;
  loading: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
      <p className="text-sm text-muted-foreground max-w-[280px]">{text}</p>
      <Button size="sm" onClick={onClick} disabled={loading}>
        {label}
      </Button>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-8 gap-3">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

function RefreshButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="pt-2 flex justify-end">
      <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
        ) : null}
        Re-analyze
      </Button>
    </div>
  );
}
