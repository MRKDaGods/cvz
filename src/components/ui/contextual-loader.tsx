"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextualLoaderProps {
  messages: string[];
  intervalMs?: number;
  className?: string;
  iconClassName?: string;
  messageClassName?: string;
}

export function ContextualLoader({
  messages,
  intervalMs = 2400,
  className,
  iconClassName,
  messageClassName,
}: ContextualLoaderProps) {
  const [index, setIndex] = useState(0);
  const normalizedMessages = useMemo(
    () => (messages.length > 0 ? messages : ["Working on it..."]),
    [messages]
  );

  useEffect(() => {
    if (normalizedMessages.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % normalizedMessages.length);
    }, intervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [intervalMs, normalizedMessages]);

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-20", className)}>
      <Loader2 className={cn("h-8 w-8 animate-spin text-muted-foreground", iconClassName)} />
      <span className={cn("text-sm text-muted-foreground", messageClassName)}>
        {normalizedMessages[index % normalizedMessages.length]}
      </span>
    </div>
  );
}
