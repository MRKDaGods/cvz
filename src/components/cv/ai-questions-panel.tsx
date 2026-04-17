"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiComment, CvSection } from "@/stores/cv-store";
import { cn } from "@/lib/utils";

interface QuestionItem {
  question: string;
  comment: AiComment;
  sectionTitle: string;
  sectionId: string;
}

interface AiQuestionsPanelProps {
  sections: CvSection[];
  /** Called with the full compiled answers string when user submits */
  onSubmitAnswers: (answers: string) => void;
}

const severityOrder = { critical: 0, important: 1, suggestion: 2 } as const;

const severityMeta = {
  critical: {
    icon: AlertTriangle,
    iconClass: "text-red-500",
    label: "Verify",
    labelClass: "text-red-600 dark:text-red-400",
    dotClass: "bg-red-500",
  },
  important: {
    icon: Lightbulb,
    iconClass: "text-orange-500",
    label: "Improve",
    labelClass: "text-orange-600 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
  suggestion: {
    icon: HelpCircle,
    iconClass: "text-blue-400",
    label: "Polish",
    labelClass: "text-blue-500 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
};

export function AiQuestionsPanel({ sections, onSubmitAnswers }: AiQuestionsPanelProps) {
  // Collect all questions from all sections, sorted by severity
  const questions = useMemo(() => {
    const items: QuestionItem[] = [];
    for (const section of sections) {
      if (!section.aiComments) continue;
      for (const comment of section.aiComments) {
        if (comment.question) {
          items.push({
            question: comment.question,
            comment,
            sectionTitle: section.title,
            sectionId: section.id,
          });
        }
      }
    }
    items.sort((a, b) => {
      // Unapplied first
      const aApplied = a.comment.applied ? 1 : 0;
      const bApplied = b.comment.applied ? 1 : 0;
      if (aApplied !== bApplied) return aApplied - bApplied;
      return severityOrder[a.comment.severity] - severityOrder[b.comment.severity];
    });
    return items;
  }, [sections]);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const answeredCount = Object.values(answers).filter((v) => v.trim()).length;
  const visibleQuestions = questions.filter((_, i) => !dismissed.has(i));
  const criticalUnanswered = visibleQuestions.filter(
    (q) => q.comment.severity === "critical" && !q.comment.applied && !answers[questions.indexOf(q)]?.trim()
  ).length;

  if (questions.length === 0) return null;

  const handleSubmit = () => {
    const lines: string[] = [];
    for (let i = 0; i < questions.length; i++) {
      const answer = answers[i]?.trim();
      if (answer) {
        lines.push(`• [${questions[i].sectionTitle}] Q: ${questions[i].question}`);
        lines.push(`  A: ${answer}`);
      }
    }
    if (lines.length > 0) {
      onSubmitAnswers(lines.join("\n"));
    }
  };

  const handleDismiss = (idx: number) => {
    setDismissed((prev) => new Set(prev).add(idx));
  };

  return (
    <div>
      {/* Subheading */}
      <div className="pb-2">
        <p className="text-xs text-muted-foreground">
          Answer these to help the AI produce a more accurate CV. {criticalUnanswered > 0 && (
            <span className="text-red-600 dark:text-red-400 font-medium">
              {criticalUnanswered} critical question{criticalUnanswered !== 1 ? "s" : ""} need verification.
            </span>
          )}
        </p>
      </div>

      {/* Questions list */}
      <div className="space-y-3">
        {questions.map((q, i) => {
          if (dismissed.has(i)) return null;
          const meta = severityMeta[q.comment.severity];
          const SevIcon = meta.icon;
          const isAnswered = !!answers[i]?.trim();
          const isApplied = !!q.comment.applied;

          return (
            <div
              key={`${q.sectionId}-${i}`}
              className={cn(
                "rounded-md border p-3 space-y-2 transition-colors",
                isAnswered && "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10",
                isApplied && !isAnswered && "border-muted bg-muted/20",
              )}
            >
              {/* Top line: severity + section */}
              <div className="flex items-center gap-2 text-[11px]">
                {isAnswered ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <SevIcon className={cn("h-3.5 w-3.5 shrink-0", meta.iconClass)} />
                )}
                <span className={cn("font-semibold uppercase", isAnswered ? "text-emerald-600 dark:text-emerald-400" : meta.labelClass)}>
                  {isApplied ? "Verify" : meta.label}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground truncate">{q.sectionTitle}</span>
                <div className="flex-1" />
                <button
                  type="button"
                  className="text-muted-foreground/50 hover:text-muted-foreground text-[10px] transition-colors"
                  onClick={() => handleDismiss(i)}
                >
                  skip
                </button>
              </div>

              {/* Question text */}
              <p className="text-sm leading-relaxed pl-5.5">
                {q.question}
              </p>

              {/* What the AI did (context) */}
              {q.comment.text && (
                <p className="text-xs text-muted-foreground pl-5.5 leading-relaxed">
                  <span className="font-medium">Context:</span> {q.comment.text}
                </p>
              )}

              {/* Answer input */}
              <div className="pl-5.5">
                <Input
                  placeholder={isApplied ? "Confirm or correct..." : "Your answer..."}
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with submit */}
      {answeredCount > 0 && (
        <div className="pt-3 mt-3 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Your answers will be added to the notes for re-optimization.
          </p>
          <Button size="sm" onClick={handleSubmit} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Add {answeredCount} answer{answeredCount !== 1 ? "s" : ""} to notes
          </Button>
        </div>
      )}
    </div>
  );
}
