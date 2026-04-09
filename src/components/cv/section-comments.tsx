"use client";

import { useMemo, useState } from "react";
import {
  Target,
  BarChart3,
  Type,
  FileText,
  Eye,
  Search,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  Check,
  X,
  Loader2,
  MessageSquareText,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AiComment } from "@/stores/cv-store";
import { cn } from "@/lib/utils";

const severityConfig = {
  critical: {
    border: "border-l-red-500",
    icon: AlertTriangle,
    iconClass: "text-red-500",
    label: "Verify",
    labelClass: "text-red-600 dark:text-red-400",
  },
  important: {
    border: "border-l-orange-500",
    icon: Lightbulb,
    iconClass: "text-orange-500",
    label: "Improve",
    labelClass: "text-orange-600 dark:text-orange-400",
  },
  suggestion: {
    border: "border-l-blue-500",
    icon: Lightbulb,
    iconClass: "text-blue-400",
    label: "Polish",
    labelClass: "text-blue-500 dark:text-blue-400",
  },
};

const categoryIcons = {
  impact: BarChart3,
  keywords: Target,
  formatting: Type,
  content: FileText,
  clarity: Eye,
  ats: Search,
};

interface SectionCommentsProps {
  comments: AiComment[];
  showHeading?: boolean;
  showFixes?: "always" | "collapsed" | "never";
  compact?: boolean;
  maxInitial?: number;
  /** Called when user confirms applying a fix. userContext is the extra info they typed (if askForDetails is on). */
  onApplyFix?: (comment: AiComment, index: number, userContext?: string) => void;
  onDismiss?: (comment: AiComment, index: number) => void;
  /** When true, clicking "Apply fix" opens an inline input first. */
  askForDetails?: boolean;
  /** Index of the comment currently being applied (shows spinner). */
  applyingIndex?: number | null;
}

export function SectionComments({
  comments,
  showHeading = true,
  showFixes = "collapsed",
  compact = false,
  maxInitial,
  onApplyFix,
  onDismiss,
  askForDetails = false,
  applyingIndex = null,
}: SectionCommentsProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedFixIdx, setExpandedFixIdx] = useState<number | null>(null);
  const [userContext, setUserContext] = useState("");

  const sorted = useMemo(() => {
    return [...comments].sort((a, b) => {
      // Pending comments first, applied last
      if (a.applied !== b.applied) return a.applied ? 1 : -1;
      const order = { critical: 0, important: 1, suggestion: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [comments]);

  const visibleComments =
    maxInitial && !showAll ? sorted.slice(0, maxInitial) : sorted;

  const criticalCount = sorted.filter((c) => c.severity === "critical").length;
  const importantCount = sorted.filter((c) => c.severity === "important").length;
  const suggestionCount = sorted.filter((c) => c.severity === "suggestion").length;
  const appliedCount = sorted.filter((c) => c.applied).length;
  const pendingCount = sorted.length - appliedCount;

  return (
    <div className="space-y-2">
      {showHeading && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Feedback
          </span>
          <div className="flex items-center gap-1.5 text-[11px]">
            {appliedCount > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{appliedCount} applied</span>
            )}
            {pendingCount > 0 && criticalCount > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">{criticalCount - sorted.filter(c => c.severity === "critical" && c.applied).length} verify</span>
            )}
            {pendingCount > 0 && importantCount > 0 && (
              <span className="text-orange-600 dark:text-orange-400 font-medium">{importantCount - sorted.filter(c => c.severity === "important" && c.applied).length} improve</span>
            )}
            {pendingCount > 0 && suggestionCount > 0 && (
              <span className="text-muted-foreground">{suggestionCount - sorted.filter(c => c.severity === "suggestion" && c.applied).length} polish</span>
            )}
          </div>
        </div>
      )}

      <div className={cn("space-y-3", compact && "space-y-2")}>
        {visibleComments.map((comment, i) => {
          const sev = severityConfig[comment.severity];
          const CatIcon = categoryIcons[comment.category] ?? FileText;
          const bulletLabel = comment.bulletIndex != null ? `Bullet ${comment.bulletIndex + 1}` : null;
          const isApplying = applyingIndex === i;
          const isExpanded = expandedFixIdx === i;
          const isAlreadyApplied = !!comment.applied;

          const handleApplyClick = () => {
            if (!onApplyFix) return;
            if (askForDetails && comment.fix && !isAlreadyApplied) {
              setExpandedFixIdx(i);
              setUserContext("");
            } else {
              onApplyFix(comment, i);
            }
          };

          const handleSubmitWithContext = () => {
            if (!onApplyFix) return;
            onApplyFix(comment, i, userContext.trim() || undefined);
            setExpandedFixIdx(null);
            setUserContext("");
          };

          const handleCancelContext = () => {
            setExpandedFixIdx(null);
            setUserContext("");
          };

          return (
            <div
              key={`${comment.text}-${i}`}
              className={cn(
                "border-l-2 rounded-r bg-muted/30 px-4 py-3",
                isAlreadyApplied ? "border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10" : sev.border,
                isApplying && "opacity-60 pointer-events-none",
              )}
            >
              <div className="flex items-start gap-2">
                {isAlreadyApplied
                  ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  : <CatIcon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", sev.iconClass)} />
                }
                  <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {isAlreadyApplied ? (
                      <span className="text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                        Applied
                      </span>
                    ) : (
                      <span className={cn("text-[11px] font-semibold uppercase", sev.labelClass)}>
                        {sev.label}
                      </span>
                    )}
                    {bulletLabel && (
                      <Badge variant="secondary" className="text-[9px] h-3.5 px-1 font-normal">
                        {bulletLabel}
                      </Badge>
                    )}
                    {isApplying && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  <p className={cn("text-sm leading-relaxed text-foreground/85", compact && "text-xs")}>
                    {comment.text}
                  </p>
                </div>
              </div>

              {/* Fix text + action buttons */}
              {comment.fix && (
                <div className="mt-2.5 ml-5.5 space-y-2">
                  {showFixes === "always" && (
                    <div className={cn(
                      "rounded border px-2.5 py-1.5 text-xs leading-relaxed",
                      isAlreadyApplied
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-foreground/75"
                        : "bg-background/60 text-foreground/75",
                    )}>
                      <span className="font-medium text-foreground/90">{isAlreadyApplied ? "What changed:" : "Fix:"}</span> {comment.fix}
                    </div>
                  )}

                  {showFixes === "collapsed" && (
                    <details className="group" open={isAlreadyApplied}>
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                        {isAlreadyApplied ? "Show what changed" : "Show suggested fix"}
                      </summary>
                      <div className={cn(
                        "mt-1 rounded border px-2.5 py-1.5 text-xs leading-relaxed",
                        isAlreadyApplied
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-foreground/75"
                          : "bg-background/60 text-foreground/75",
                      )}>
                        {comment.fix}
                      </div>
                    </details>
                  )}

                  {/* Action buttons — different for applied vs pending */}
                  {isAlreadyApplied ? (
                    // Applied: just acknowledge/dismiss
                    onDismiss && !isExpanded && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                            className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          onClick={() => onDismiss(comment, i)}
                        >
                          <Check className="h-3 w-3" />
                          Acknowledge
                        </button>
                      </div>
                    )
                  ) : (
                    // Pending: apply fix + dismiss
                    (onApplyFix || onDismiss) && !isExpanded && (
                      <div className="flex items-center gap-1.5">
                        {onApplyFix && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            onClick={handleApplyClick}
                          >
                            <Check className="h-3 w-3" />
                            Apply fix
                          </button>
                        )}
                        {onDismiss && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            onClick={() => onDismiss(comment, i)}
                          >
                            <X className="h-3 w-3" />
                            Dismiss
                          </button>
                        )}
                      </div>
                    )
                  )}

                  {/* Inline context input (when askForDetails is on) */}
                  {isExpanded && (
                    <div className="rounded border bg-background p-2.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                        <MessageSquareText className="h-3.5 w-3.5 text-primary" />
                        {comment.question || "Add context for this fix"}
                      </div>
                      <textarea
                        className="w-full rounded border bg-muted/30 px-2.5 py-1.5 text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
                        rows={2}
                        placeholder={comment.question ? "Type your answer here..." : "e.g., The actual improvement was 35%, the team had 8 people..."}
                        value={userContext}
                        onChange={(e) => setUserContext(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            handleSubmitWithContext();
                          }
                        }}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          Ctrl+Enter to apply &middot; leave empty to apply as-is
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            onClick={handleCancelContext}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            onClick={handleSubmitWithContext}
                          >
                            <Check className="h-3 w-3" />
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Comments without a fix: just show dismiss */}
              {!comment.fix && onDismiss && (
                <div className="mt-1.5 ml-5.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => onDismiss(comment, i)}
                  >
                    <X className="h-3 w-3" />
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {maxInitial && sorted.length > maxInitial ? (
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer comments" : `Show ${sorted.length - maxInitial} more comments`}
        </button>
      ) : null}
    </div>
  );
}
