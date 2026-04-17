"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionComments } from "@/components/cv/section-comments";
import { useCvStore, persistSection, type AiComment } from "@/stores/cv-store";
import { useModelStore } from "@/stores/model-store";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useStreaming } from "@/hooks/use-streaming";
import { useUsageStore } from "@/stores/usage-store";
import { ModelSelector } from "@/components/session/model-selector";
import { StreamingOutput } from "@/components/session/streaming-output";
import { JsonViewerButton } from "@/components/session/json-viewer";
import { extractJSON, formatSectionContentPreview, serializeSectionContent, toStringArray } from "@/lib/utils";
import { toast } from "sonner";

interface RefinementDialogProps {
  sectionId: string;
  sessionId: string;
  onClose: () => void;
}

interface RefinementProposal {
  title: string;
  rawContent: unknown;
  content: string;
  entries?: unknown[];
  assistantMessage: string;
  changeSummary: string[];
  aiComments: AiComment[];
}

type RefinementRequestMode = "rewrite" | "ask";

function formatPreviewContent(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return value;
    }
  }

  if (value == null) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseAiComments(value: unknown): AiComment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const comment = entry as Record<string, unknown>;
    const text = typeof comment.text === "string" ? comment.text.trim() : "";
    const severity =
      comment.severity === "critical" ||
      comment.severity === "important" ||
      comment.severity === "suggestion"
        ? comment.severity
        : "suggestion";
    const category =
      comment.category === "impact" ||
      comment.category === "keywords" ||
      comment.category === "formatting" ||
      comment.category === "content" ||
      comment.category === "clarity" ||
      comment.category === "ats"
        ? comment.category
        : "content";

    if (!text) return [];

    return [
      {
        text,
        fix: typeof comment.fix === "string" ? comment.fix : undefined,
        severity,
        category,
        bulletIndex:
          typeof comment.bulletIndex === "number" ? comment.bulletIndex : undefined,
        applied: comment.applied === true,
        question: typeof comment.question === "string" ? comment.question : undefined,
      },
    ];
  });
}

function parseRefinementProposal(raw: string, fallbackTitle: string): RefinementProposal {
  const parsed = extractJSON(raw);
  const aiComments = parseAiComments(parsed.aiComments);
  const assistantMessage =
    typeof parsed.assistantMessage === "string" && parsed.assistantMessage.trim()
      ? parsed.assistantMessage.trim()
      : aiComments.length > 0
        ? aiComments[0].text
        : "The model returned a revised proposal.";

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : fallbackTitle,
    rawContent: parsed.content,
    content: formatPreviewContent(parsed.content),
    entries: Array.isArray(parsed.entries) ? parsed.entries : undefined,
    assistantMessage,
    changeSummary: toStringArray(parsed.changeSummary),
    aiComments,
  };
}

export function RefinementDialog({
  sectionId,
  sessionId,
  onClose,
}: RefinementDialogProps) {
  const section = useCvStore((s) => s.sections.find((x) => x.id === sectionId));
  const updateSection = useCvStore((s) => s.updateSection);
  const getModel = useModelStore((s) => s.getModel);
  const setStageResponse = usePipelineStore((s) => s.setStageResponse);
  const [instructions, setInstructions] = useState("");
  const [requestMode, setRequestMode] = useState<RefinementRequestMode>("rewrite");
  const [responseMode, setResponseMode] = useState<RefinementRequestMode | null>(null);
  const [proposal, setProposal] = useState<RefinementProposal | null>(null);

  const currentContent = formatSectionContentPreview(
    section?.optimizedContent ?? section?.originalContent ?? "",
  );
  const addStageUsage = useUsageStore((s) => s.addStageUsage);
  const setQuota = useUsageStore((s) => s.setQuota);

  const streaming = useStreaming({
    onComplete: (content) => {
      setStageResponse("refine", content);
      try {
        const result = parseRefinementProposal(content, section?.title ?? "Untitled");
        setProposal(result);
        setResponseMode(requestMode);
        toast.success(
          requestMode === "ask"
            ? `Answer ready for ${section?.title}`
            : `Proposal ready for ${section?.title}`,
        );
      } catch {
        toast.error("Failed to parse refinement result");
      }
    },
    onError: (error) => toast.error(error),
    onUsage: (u) => {
      addStageUsage("refine", u);
      if (u.quota) setQuota(u.quota);
    },
  });

  const handleRefine = () => {
    streaming.start("/api/pipeline/refine", {
      sessionId,
      sectionId,
      sectionType: section?.type,
      currentContent: proposal?.content ?? currentContent,
      userInstructions: instructions,
      aiComments: JSON.stringify(proposal?.aiComments ?? section?.aiComments ?? []),
      model: getModel("refine"),
      requestMode,
    });
  };

  const handleApplyProposal = () => {
    if (!proposal) return;

    const updates = {
      title: proposal.title,
      optimizedContent: serializeSectionContent(proposal.rawContent, proposal.entries),
      aiComments: proposal.aiComments.length > 0 ? proposal.aiComments : section?.aiComments,
    };
    updateSection(sectionId, updates);
    persistSection(sectionId, updates);
    toast.success(`${section?.title} updated`);
    onClose();
  };

  const handleDiscardProposal = () => {
    setProposal(null);
    setResponseMode(null);
    toast.message("Response cleared");
  };

  const hasDraftResponse = proposal && responseMode === "rewrite";
  const hasAskResponse = proposal && responseMode === "ask";

  if (!section) return null;

  const canApplyDraft =
    !!proposal &&
    responseMode === "rewrite" &&
    (
      proposal.title !== section.title ||
      proposal.content !== currentContent ||
      JSON.stringify(proposal.aiComments) !== JSON.stringify(section.aiComments ?? [])
    );

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Refine: {section.title}</DialogTitle>
          <DialogDescription>
            Ask about the section or generate a rewrite draft. Drafts stay pending
            until you apply them.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4 min-w-0">
            <div>
              <Label>Mode</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={requestMode === "rewrite" ? "default" : "outline"}
                  onClick={() => setRequestMode("rewrite")}
                  disabled={streaming.status === "streaming"}
                >
                  Generate Draft
                </Button>
                <Button
                  type="button"
                  variant={requestMode === "ask" ? "default" : "outline"}
                  onClick={() => setRequestMode("ask")}
                  disabled={streaming.status === "streaming"}
                >
                  Ask AI
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {requestMode === "ask"
                  ? "Ask for explanation, tradeoffs, or advice about this section without creating a draft to apply."
                  : "Generate a new candidate version that you can compare and apply manually."}
              </p>
            </div>

            <div>
              <Label htmlFor="instructions">
                {requestMode === "ask"
                  ? "Question"
                  : proposal
                    ? "Follow-up question or revision request"
                    : "Instructions"}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {requestMode === "ask"
                  ? "Examples: Why did you change this bullet? What is still weak here? Which metrics are missing?"
                  : proposal
                  ? "Ask what changed, challenge a suggestion, or request another draft. If you only ask a question, the content can stay unchanged."
                  : "Tell the AI what to improve. Existing section feedback is included automatically."}
              </p>
              <Textarea
                id="instructions"
                placeholder={
                  requestMode === "ask"
                    ? "e.g., Why did you cut the second bullet, and what evidence is missing to make it stronger?"
                    : proposal
                      ? "e.g., Why did you cut the second bullet? Keep the current scope but make it sharper."
                      : "e.g., Make this more technical, emphasize leadership, add more metrics..."
                }
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="mt-2 min-h-[100px] max-h-48 resize-y"
              />
            </div>

            <StreamingOutput
              status={streaming.status}
              content={streaming.content}
              thinking={streaming.thinking}
              label={
                requestMode === "ask"
                  ? "Asking about this section..."
                  : proposal
                    ? "Generating a revised draft..."
                    : "Generating draft..."
              }
              showPreview
            />

            {proposal && (
              <Tabs defaultValue="compare" className="min-w-0">
                <TabsList>
                  {hasDraftResponse && <TabsTrigger value="compare">Compare</TabsTrigger>}
                  <TabsTrigger value="ai">AI Notes</TabsTrigger>
                </TabsList>
                {hasDraftResponse && (
                  <TabsContent value="compare" className="min-w-0">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2 min-w-0">
                      <div>
                        <h3 className="text-sm font-semibold">Current</h3>
                        <p className="text-xs text-muted-foreground">
                          The version currently stored on the section.
                        </p>
                      </div>
                      <ScrollArea className="h-[320px] rounded-lg border bg-muted/30">
                        <pre className="p-4 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                          {currentContent}
                        </pre>
                      </ScrollArea>
                    </div>
                    <div className="space-y-2 min-w-0">
                      <div>
                        <h3 className="text-sm font-semibold">Proposed</h3>
                        <p className="text-xs text-muted-foreground">
                          Pending draft from the latest AI response.
                        </p>
                      </div>
                      <ScrollArea className="h-[320px] rounded-lg border bg-muted/30">
                        <pre className="p-4 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                          {proposal.content}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                  </TabsContent>
                )}
                <TabsContent value="ai" className="space-y-4 min-w-0">
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">What the AI said</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {proposal.assistantMessage}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Change Summary
                      </h4>
                      {proposal.changeSummary.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {proposal.changeSummary.map((item, index) => (
                            <li key={`${item}-${index}`} className="rounded border bg-background px-3 py-2">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No detailed change summary was returned.
                        </p>
                      )}
                    </div>
                  </div>

                  {proposal.aiComments.length > 0 && (
                    <SectionComments comments={proposal.aiComments} />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Current AI Feedback</h3>
              <p className="text-xs text-muted-foreground">
                Existing comments are carried into each request, but the rewrite wording stays collapsed unless you open it.
              </p>
              {section.aiComments && section.aiComments.length > 0 ? (
                <SectionComments
                  comments={section.aiComments}
                  showHeading={false}
                  showFixes="collapsed"
                  compact
                  maxInitial={3}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No saved AI feedback on this section yet.
                </p>
              )}
            </div>
            {proposal && (
              <>
                {proposal.aiComments.length > 0 ? (
                  <SectionComments
                    comments={proposal.aiComments}
                    showFixes="collapsed"
                    maxInitial={4}
                  />
                ) : null}
                <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <h3 className="text-sm font-semibold">Draft Status</h3>
                  <p className="text-sm text-muted-foreground">
                    The proposal is only staged in this dialog. Nothing changes in the section until you click Apply Draft.
                  </p>
                </div>
              </>
            )}

            {hasAskResponse && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <h3 className="text-sm font-semibold">Answer Only</h3>
                <p className="text-sm text-muted-foreground">
                  This response did not create a pending draft. The section stays unchanged unless you switch back to Generate Draft.
                </p>
              </div>
            )}
          </div>
        </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <ModelSelector stage="refine" disabled={streaming.status === "streaming"} />
            <JsonViewerButton stage="refine" />
          </div>
          <div className="flex gap-2">
            {proposal ? (
              <Button variant="outline" onClick={handleDiscardProposal}>
                <X className="mr-2 h-4 w-4" />
                Clear Response
              </Button>
            ) : (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleRefine}
              disabled={streaming.status === "streaming"}
              variant={proposal ? "outline" : "default"}
            >
              {streaming.status === "streaming" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {requestMode === "ask" ? "Asking..." : "Generating..."}
                </>
              ) : (
                <>
                  {proposal ? <RefreshCw className="mr-2 h-4 w-4" /> : null}
                  {requestMode === "ask"
                    ? proposal
                      ? "Ask Again"
                      : "Ask AI"
                    : proposal
                      ? "Revise Again"
                      : "Generate Draft"}
                </>
              )}
            </Button>
            {canApplyDraft && (
              <Button onClick={handleApplyProposal} disabled={streaming.status === "streaming"}>
                <Check className="mr-2 h-4 w-4" />
                Apply Draft
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
