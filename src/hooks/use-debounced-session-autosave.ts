"use client";

import { useEffect, useRef } from "react";
import { useCvStore } from "@/stores/cv-store";

interface AutosaveSectionPayload {
  id: string;
  type: string;
  title: string;
  originalContent: string;
  optimizedContent: string | null;
  latexContent: string | null;
  aiComments: unknown;
  userNotes: string | null;
  order: number;
}

function normalizeSections(sections: ReturnType<typeof useCvStore.getState>["sections"]): AutosaveSectionPayload[] {
  return sections.map((section) => ({
    id: section.id,
    type: section.type,
    title: section.title,
    originalContent: section.originalContent,
    optimizedContent: section.optimizedContent,
    latexContent: section.latexContent,
    aiComments: section.aiComments,
    userNotes: section.userNotes,
    order: section.order,
  }));
}

interface UseDebouncedSessionAutosaveOptions {
  enabled?: boolean;
  delayMs?: number;
}

export function useDebouncedSessionAutosave(
  sessionId: string | null,
  options: UseDebouncedSessionAutosaveOptions = {}
) {
  const sections = useCvStore((s) => s.sections);
  const enabled = options.enabled ?? true;
  const delayMs = options.delayMs ?? 2000;
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);
  const activeSessionRef = useRef<string | null>(null);
  const lastSavedPayloadRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId) {
      return;
    }

    const payloadSections = normalizeSections(sections);
    const serialized = JSON.stringify(payloadSections);

    if (!initializedRef.current || activeSessionRef.current !== sessionId) {
      initializedRef.current = true;
      activeSessionRef.current = sessionId;
      lastSavedPayloadRef.current = serialized;
      return;
    }

    if (serialized === lastSavedPayloadRef.current) {
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sections: payloadSections }),
          signal: controller.signal,
        });

        if (response.ok) {
          lastSavedPayloadRef.current = serialized;
        }
      } catch {
        // Ignore transient autosave errors. Explicit user actions already have error toasts.
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    }, delayMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [delayMs, enabled, sections, sessionId]);
}
