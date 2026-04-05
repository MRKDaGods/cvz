"use client";

import { useEffect, useState } from "react";

interface SessionData {
  id: string;
  title: string;
  stage: string;
  templateId: string;
  jobDesc: string | null;
  rawCvText: string | null;
  fieldAnalysis: string | null;
  keywords: string | null;
  latexSource: string | null;
  pdfPath: string | null;
  sections: SessionSection[];
  scores: SessionScores | null;
}

interface SessionSection {
  id: string;
  type: string;
  title: string;
  originalContent: string;
  optimizedContent: string | null;
  latexContent: string | null;
  aiComments: string | null;
  userNotes: string | null;
  order: number;
}

interface SessionScores {
  atsBefore: number;
  atsAfter: number;
  jobFitBefore: number;
  jobFitAfter: number;
  qualityBefore: number;
  qualityAfter: number;
  tierBefore: string;
  tierAfter: string;
}

interface UseSessionReturn {
  session: SessionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  update: (data: Partial<SessionData>) => Promise<void>;
}

export function useSession(sessionId: string | null): UseSessionReturn {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(!!sessionId);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  };

  const update = async (data: Partial<SessionData>) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setSession((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update session");
    }
  };

  useEffect(() => {
    if (sessionId) {
      refetch();
    } else {
      setSession(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { session, loading, error, refetch, update };
}
