"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, MessageCircleQuestion, MessageSquareText, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useCvStore, type CvSection, type AiComment } from "@/stores/cv-store";
import { useModelStore } from "@/stores/model-store";
import { useUiStore } from "@/stores/ui-store";
import { SectionCard } from "@/components/cv/section-card";
import { ScoreChart } from "@/components/cv/score-chart";
import { AiQuestionsPanel } from "@/components/cv/ai-questions-panel";
import { RefinementDialog } from "@/components/cv/refinement-dialog";
import { ModelSelector } from "@/components/session/model-selector";
import { StreamingOutput } from "@/components/session/streaming-output";
import { JsonViewerButton } from "@/components/session/json-viewer";
import { useStreaming } from "@/hooks/use-streaming";
import { useUsageStore } from "@/stores/usage-store";
import { extractJSON, formatSectionContentPreview, serializeSectionContent } from "@/lib/utils";
import { toast } from "sonner";

export function OptimizeStep() {
  const sessionId = usePipelineStore((s) => s.activeSessionId);
  const setStep = usePipelineStore((s) => s.setStep);
  const sections = useCvStore((s) => s.sections);
  const setSections = useCvStore((s) => s.setSections);
  const updateSection = useCvStore((s) => s.updateSection);
  const scores = useCvStore((s) => s.scores);
  const setScores = useCvStore((s) => s.setScores);
  const getModel = useModelStore((s) => s.getModel);
  const setStageResponse = usePipelineStore((s) => s.setStageResponse);
  const addStageUsage = useUsageStore((s) => s.addStageUsage);
  const setQuota = useUsageStore((s) => s.setQuota);
  const askForDetails = useUiStore((s) => s.askForDetails);
  const setAskForDetails = useUiStore((s) => s.setAskForDetails);
  const [optimized, setOptimized] = useState(!!scores);
  const [refiningSection, setRefiningSection] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [iterationCount, setIterationCount] = useState(0);
  const [applyingFix, setApplyingFix] = useState<{
    sectionId: string;
    commentIndex: number;
  } | null>(null);
  // Track which section ID the fix-apply streaming belongs to
  const applyingRef = useRef<{ sectionId: string; commentText: string } | null>(null);

  const streaming = useStreaming({
    onComplete: (content) => {
      setStageResponse("optimize", content);
      try {
        const result = extractJSON(content);
        const resultSections = (Array.isArray(result.sections) ? result.sections : []) as Record<string, unknown>[];
        if (resultSections.length > 0) {
          // Match optimized sections back to originals by type (LLM may reorder)
          const originalByType = new Map<string, typeof sections[number]>();
          for (const s of sections) {
            // Use first match per type (there may be duplicates with "custom")
            if (!originalByType.has(s.type)) {
              originalByType.set(s.type, s);
            }
          }

          setSections(
            resultSections.map(
              (s, i) => {
                const original = originalByType.get(s.type as string);
                return {
                  id: original?.id ?? `opt-${i}`,
                  type: String(s.type ?? "other"),
                  title: String(s.title ?? ""),
                  originalContent: original?.originalContent ?? "",
                  optimizedContent: serializeSectionContent(
                    s.content as string,
                    Array.isArray(s.entries) ? s.entries as Record<string, unknown>[] : undefined,
                  ),
                  latexContent: null,
                  aiComments: s.aiComments as CvSection["aiComments"] ?? null,
                  userNotes: null,
                  order: i,
                };
              }
            )
          );
        }
        if (result.scores) {
          setScores(result.scores as import("@/stores/cv-store").Scores);
        }
        setOptimized(true);
        setIterationCount((c) => c + 1);
        toast.success("CV optimized!");
      } catch {
        toast.error("Failed to parse optimization result");
      }
    },
    onError: (error) => toast.error(error),
    onUsage: (u) => {
      addStageUsage("optimize", u);
      if (u.quota) setQuota(u.quota);
    },
  });

  const handleOptimize = useCallback(() => {
    streaming.start("/api/pipeline/optimize", {
      sessionId,
      model: getModel("optimize"),
      userNotes: userNotes.trim() || undefined,
    });
  }, [sessionId, streaming, getModel, userNotes]);

  const handleContinue = async () => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "finalize" }),
      });
      setStep("finalize");
    } catch {
      toast.error("Failed to save progress");
    }
  };

  // Streaming hook for AI-assisted fix application
  const fixStreaming = useStreaming({
    onComplete: (content) => {
      setStageResponse("refine", content);
      const ref = applyingRef.current;
      if (!ref) return;
      try {
        const result = extractJSON(content);
        const section = useCvStore.getState().sections.find((s) => s.id === ref.sectionId);
        if (section && result.content) {
          updateSection(ref.sectionId, {
            optimizedContent: serializeSectionContent(
              result.content,
              Array.isArray(result.entries) ? result.entries : undefined,
            ),
            aiComments:
              section.aiComments?.filter((c) => c.text !== ref.commentText) ?? null,
          });
          toast.success("Fix applied with your context");
        }
      } catch {
        toast.error("Failed to parse AI response");
      }
      setApplyingFix(null);
      applyingRef.current = null;
    },
    onError: (error) => {
      toast.error(error);
      setApplyingFix(null);
      applyingRef.current = null;
    },
    onUsage: (u) => {
      addStageUsage("refine", u);
      if (u.quota) setQuota(u.quota);
    },
  });

  const handleApplyFix = useCallback(
    (sectionId: string, comment: AiComment, commentIndex: number, userContext?: string) => {
      if (!comment.fix) return;
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;

      const content = section.optimizedContent ?? section.originalContent;

      // If there's user context, use the refine API for an AI-assisted apply
      if (userContext) {
        applyingRef.current = { sectionId, commentText: comment.text };
        setApplyingFix({ sectionId, commentIndex });
        fixStreaming.start("/api/pipeline/refine", {
          sessionId,
          sectionId,
          sectionType: section.type,
          currentContent: formatSectionContentPreview(content),
          userInstructions: `Apply this specific fix: "${comment.fix}"\n\nUser-provided context: ${userContext}`,
          aiComments: JSON.stringify(section.aiComments ?? []),
          model: getModel("refine"),
          requestMode: "rewrite",
        });
        return;
      }

      // Direct apply — just remove the comment
      updateSection(sectionId, {
        optimizedContent: content,
        aiComments:
          section.aiComments?.filter((c) => c.text !== comment.text) ?? null,
      });
      toast.success("Fix applied");
    },
    [sections, updateSection, sessionId, getModel, fixStreaming],
  );

  const handleDismissComment = useCallback(
    (sectionId: string, comment: AiComment) => {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;
      updateSection(sectionId, {
        aiComments:
          section.aiComments?.filter((c) => c.text !== comment.text) ?? null,
      });
      toast.message("Comment dismissed");
    },
    [sections, updateSection],
  );

  const isLoading = streaming.status === "streaming";
  const isApplyingFix = fixStreaming.status === "streaming";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="text-center">
        <h2 className="text-lg font-medium">Optimize Your CV</h2>
        <p className="text-sm text-muted-foreground mt-2">
          AI rewrites each section with STAR method, quantified impact, and keyword optimization.
        </p>
      </div>

      {!isLoading && (
        <div className="flex flex-col items-center gap-4">
          <ModelSelector stage="optimize" />

          {!optimized ? (
            <>
              {/* Pre-optimization notes */}
              <div className="w-full max-w-2xl">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1.5"
                  onClick={() => setNotesOpen(!notesOpen)}
                >
                  {notesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Pencil className="h-3 w-3" />
                  Add notes, corrections, or extra details (optional)
                </button>
                {notesOpen && (
                  <Textarea
                    placeholder={"Tell the AI about corrections or extra context. Examples:\n• I also have 2 years of AWS experience\n• I stopped working at Company X in March 2024, not present\n• Add that I'm certified in Kubernetes (CKA)\n• My role at Y was more of a tech lead than just senior engineer"}
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    className="min-h-[100px] text-sm"
                  />
                )}
              </div>
              <Button onClick={handleOptimize}>
                <Sparkles className="mr-2 h-4 w-4" />
                Start Optimization
              </Button>
            </>
          ) : (
            <Card className="w-full" size="sm">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  Refine & Re-optimize
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Questions — collapsible */}
                {sections.some((s) => s.aiComments?.some((c) => c.question)) && (
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                      onClick={() => setQuestionsOpen(!questionsOpen)}
                    >
                      {questionsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <MessageCircleQuestion className="h-3 w-3" />
                      AI Questions
                      <Badge variant="secondary" className="text-[10px] h-4 ml-0.5">
                        {sections.reduce((n, s) => n + (s.aiComments?.filter((c) => c.question).length ?? 0), 0)}
                      </Badge>
                    </button>
                    {questionsOpen && (
                      <AiQuestionsPanel
                        sections={sections}
                        onSubmitAnswers={(answersText) => {
                          setUserNotes((prev) => {
                            const separator = prev.trim() ? "\n\n" : "";
                            return prev + separator + answersText;
                          });
                          setNotesOpen(true);
                          toast.success("Answers added to notes — click Re-optimize to apply");
                        }}
                      />
                    )}
                  </div>
                )}

                {/* User notes — corrections, additions, context */}
                <div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1.5"
                    onClick={() => setNotesOpen(!notesOpen)}
                  >
                    {notesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <Pencil className="h-3 w-3" />
                    Add corrections or details for re-optimization
                  </button>
                  {notesOpen && (
                    <Textarea
                      placeholder={"Tell the AI about corrections or extra context. Examples:\n• I also have 2 years of AWS experience\n• I stopped working at Company X in March 2024, not present\n• Add that I'm certified in Kubernetes (CKA)\n• My role at Y was more of a tech lead than just senior engineer"}
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      className="min-h-[100px] text-sm"
                    />
                  )}
                </div>

                {/* Re-optimize button */}
                <div className="flex justify-center pt-1">
                  <Button variant="outline" onClick={handleOptimize} disabled={!userNotes.trim() && iterationCount > 0}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Re-optimize{userNotes.trim() ? " with Notes" : ""}
                    {iterationCount > 0 && <span className="ml-1.5 text-xs text-muted-foreground">(#{iterationCount + 1})</span>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <StreamingOutput
        status={streaming.status}
        content={streaming.content}
        thinking={streaming.thinking}
        label="Optimizing your CV..."
        showPreview
      />

      {/* Score Charts */}
      {scores && (
        <div className="space-y-2">
          <ScoreChart scores={scores} />
          <div className="flex justify-end">
            <JsonViewerButton stage="optimize" />
          </div>
        </div>
      )}

      {/* Sections with AI Comments */}
      {optimized && sections.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Sections</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-muted-foreground/40 accent-primary"
                  checked={askForDetails}
                  onChange={(e) => setAskForDetails(e.target.checked)}
                />
                <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ask me for details</span>
              </label>
            </div>
          </div>
          {sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                mode="optimize"
                onRefine={() => setRefiningSection(section.id)}
                onApplyFix={(comment, idx, ctx) => handleApplyFix(section.id, comment, idx, ctx)}
                onDismissComment={(comment) => handleDismissComment(section.id, comment)}
                askForDetails={askForDetails}
                applyingCommentIndex={applyingFix?.sectionId === section.id ? applyingFix.commentIndex : null}
              />
            ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("template")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!optimized || isApplyingFix}>
          Generate PDF
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Refinement dialog */}
      {refiningSection && sessionId && (
        <RefinementDialog
          sectionId={refiningSection}
          sessionId={sessionId}
          onClose={() => setRefiningSection(null)}
        />
      )}
    </div>
  );
}
