"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreamingOutputProps {
  status: "idle" | "streaming" | "done" | "error";
  content: string;
  thinking?: string;
  label: string;
  showPreview?: boolean;
  className?: string;
}

export function StreamingOutput({
  status,
  content,
  thinking,
  label,
  showPreview,
  className,
}: StreamingOutputProps) {
  const [elapsed, setElapsed] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const startTime = useRef(0);
  const previewRef = useRef<HTMLPreElement>(null);
  const thinkingRef = useRef<HTMLPreElement>(null);

  // Timer
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (status === "streaming") {
      startTime.current = Date.now();
      setElapsed(0);
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Autoscroll raw preview
  useEffect(() => {
    if (previewRef.current && previewOpen) {
      previewRef.current.scrollTo({
        top: previewRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [content, previewOpen]);

  // Autoscroll thinking preview
  useEffect(() => {
    if (thinkingRef.current && thinkingOpen) {
      thinkingRef.current.scrollTo({
        top: thinkingRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [thinking, thinkingOpen]);

  if (status === "idle") return null;

  const isDone = status === "done";
  const isError = status === "error";
  const isStreaming = status === "streaming";
  const isThinking = isStreaming && !!thinking && content.length === 0;
  const hasThinking = !!thinking && thinking.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        isDone && "border-green-500/30 bg-green-500/5",
        isError && "border-red-500/30 bg-red-500/5",
        isStreaming && "border-primary/30 bg-primary/5",
        className
      )}
    >
      {/* Status line */}
      <div className="flex items-center gap-2.5">
        {isDone ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : isThinking ? (
          <Brain className="h-4 w-4 text-violet-500 animate-pulse" />
        ) : (
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-full",
              isStreaming && "bg-green-500 animate-pulse",
              isError && "bg-red-500"
            )}
          />
        )}
        <span className="text-sm font-medium">
          {isDone
            ? "Complete"
            : isError
              ? "Error"
              : isThinking
                ? "Thinking..."
                : label}
        </span>
      </div>

      {/* Indeterminate progress bar */}
      {isStreaming && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full",
              isThinking ? "bg-violet-500" : "bg-primary"
            )}
          />
        </div>
      )}

      {/* Thinking indicator — no thinking events and no content yet */}
      {isStreaming && !hasThinking && content.length === 0 && elapsed > 0 && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Waiting for response... ({elapsed}s)
        </p>
      )}

      {/* Thinking output — model reasoning */}
      {hasThinking && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            onClick={() => setThinkingOpen(!thinkingOpen)}
          >
            {thinkingOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <Brain className="h-3 w-3" />
            Thinking ({thinking!.length.toLocaleString()} chars)
            {isThinking && <span className="animate-pulse ml-1">&middot; {elapsed}s</span>}
          </button>
          {thinkingOpen && (
            <pre
              ref={thinkingRef}
              className="mt-2 max-h-40 overflow-y-auto rounded bg-violet-500/5 border border-violet-500/20 p-3 text-xs whitespace-pre-wrap break-words"
            >
              {thinking}
            </pre>
          )}
        </div>
      )}

      {/* Stats */}
      {(isStreaming || isDone) && content.length > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {content.length.toLocaleString()} chars
          {elapsed > 0 && <> &middot; {elapsed}s</>}
        </p>
      )}

      {/* Collapsible raw preview */}
      {showPreview && content.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setPreviewOpen(!previewOpen)}
          >
            {previewOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {previewOpen ? "Hide" : "Show"} raw output
          </button>
          {previewOpen && (
            <pre
              ref={previewRef}
              className="mt-2 max-h-40 overflow-y-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"
            >
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
