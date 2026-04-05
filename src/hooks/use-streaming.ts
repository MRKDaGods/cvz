"use client";

import { useCallback, useRef, useState } from "react";

export interface StreamingUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  durationMs: number;
  quota: {
    isUnlimitedEntitlement: boolean;
    entitlementRequests: number;
    usedRequests: number;
    remainingPercentage: number;
    resetDate: string | null;
    overage: number;
  } | null;
  copilotUsage: {
    tokenDetails: { batchSize: number; costPerBatch: number; tokenCount: number; tokenType: string }[];
    totalNanoAiu: number;
  } | null;
}

interface UseStreamingOptions {
  onDelta?: (content: string) => void;
  onThinking?: (content: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: string) => void;
  onUsage?: (usage: StreamingUsage) => void;
}

interface UseStreamingReturn {
  status: "idle" | "streaming" | "done" | "error";
  content: string;
  thinking: string;
  error: string | null;
  start: (url: string, body: unknown) => Promise<void>;
  abort: () => void;
}

export function useStreaming(options?: UseStreamingOptions): UseStreamingReturn {
  const [status, setStatus] = useState<UseStreamingReturn["status"]>("idle");
  const [content, setContent] = useState("");
  const [thinking, setThinking] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const start = useCallback(
    async (url: string, body: unknown) => {
      abort();
      setContent("");
      setThinking("");
      setError(null);
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullContent = "";
        let fullThinking = "";
        let buffer = "";
        let currentEvent = "delta"; // default event type

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
              continue;
            }
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);

                if (currentEvent === "delta" && parsed.content) {
                  fullContent += parsed.content;
                  setContent(fullContent);
                  optionsRef.current?.onDelta?.(parsed.content);
                } else if (currentEvent === "thinking" && parsed.content) {
                  fullThinking += parsed.content;
                  setThinking(fullThinking);
                  optionsRef.current?.onThinking?.(parsed.content);
                } else if (currentEvent === "usage") {
                  optionsRef.current?.onUsage?.(parsed as StreamingUsage);
                } else if (currentEvent === "complete") {
                  // Use server's full content if available
                  if (parsed.content) {
                    fullContent = parsed.content;
                    setContent(fullContent);
                  }
                  // Usage may be embedded in the complete event as a fallback
                  if (parsed.usage) {
                    optionsRef.current?.onUsage?.(parsed.usage as StreamingUsage);
                  }
                } else if (currentEvent === "error" || parsed.message) {
                  setError(parsed.message ?? "Unknown error");
                  setStatus("error");
                  optionsRef.current?.onError?.(parsed.message ?? "Unknown error");
                  return;
                }
              } catch {
                // Ignore malformed JSON lines
              }
              // Reset event type after processing data line
              currentEvent = "delta";
            }
          }
        }

        setStatus("done");
        optionsRef.current?.onComplete?.(fullContent);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setStatus("idle");
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setStatus("error");
        optionsRef.current?.onError?.(message);
      }
    },
    [abort]
  );

  return { status, content, thinking, error, start, abort };
}
