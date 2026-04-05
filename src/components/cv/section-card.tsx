"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionComments } from "@/components/cv/section-comments";
import { useCvStore, type CvSection, type AiComment } from "@/stores/cv-store";
import { cn, formatSectionContentPreview } from "@/lib/utils";

interface SectionCardProps {
  section: CvSection;
  mode: "review" | "optimize" | "finalize";
  onRefine?: () => void;
  onApplyFix?: (comment: AiComment, index: number, userContext?: string) => void;
  onDismissComment?: (comment: AiComment, index: number) => void;
  askForDetails?: boolean;
  applyingCommentIndex?: number | null;
}

export function SectionCard({ section, mode, onRefine, onApplyFix, onDismissComment, askForDetails, applyingCommentIndex }: SectionCardProps) {
  const [expanded, setExpanded] = useState(mode === "review");
  const showOriginal = useCvStore((s) => s.showOriginal);

  const content =
    mode === "review" || showOriginal
      ? section.originalContent
      : section.optimizedContent ?? section.originalContent;
  const previewContent = formatSectionContentPreview(content);

  const commentCount = section.aiComments?.length ?? 0;
  const criticalCount =
    section.aiComments?.filter((c) => c.severity === "critical").length ?? 0;

  return (
    <Card className={cn(
      "transition-colors",
      criticalCount > 0 && mode === "optimize" && "border-red-200 dark:border-red-900",
    )}>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between py-3.5 px-5"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="text-sm font-medium truncate">{section.title}</CardTitle>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {section.type}
          </Badge>
          {commentCount > 0 && (
            <Badge
              variant={criticalCount > 0 ? "destructive" : "outline"}
              className="text-[10px] shrink-0"
            >
              <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
              {commentCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {(mode === "optimize" || mode === "finalize") && onRefine && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onRefine();
              }}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Refine
            </Button>
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-5 px-5 space-y-4">
          <div className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
            {previewContent}
          </div>

          {/* AI Comments — in optimize and finalize modes */}
          {section.aiComments && section.aiComments.length > 0 && (mode === "optimize" || mode === "finalize") && (
            <SectionComments
              comments={section.aiComments}
              showFixes={mode === "optimize" ? "always" : "collapsed"}
              compact
              maxInitial={mode === "finalize" ? 1 : undefined}
              onApplyFix={mode === "optimize" ? onApplyFix : undefined}
              onDismiss={mode === "optimize" ? onDismissComment : undefined}
              askForDetails={mode === "optimize" ? askForDetails : false}
              applyingIndex={mode === "optimize" ? applyingCommentIndex : null}
            />
          )}

          {/* Show original toggle hint */}
          {mode === "optimize" && section.optimizedContent && (
            <button
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => useCvStore.getState().toggleOriginal()}
            >
              {showOriginal ? "Show optimized" : "Show original"}
            </button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
