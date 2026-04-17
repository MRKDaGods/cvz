"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isWizardStep, usePipelineStore } from "@/stores/pipeline-store";
import { useCvStore } from "@/stores/cv-store";
import { useUsageStore } from "@/stores/usage-store";
import { Wizard } from "@/components/session/wizard";
import { UserMenu } from "@/components/layout/user-menu";
import { AppBrand } from "@/components/layout/app-brand";
import { useDebouncedSessionAutosave } from "@/hooks/use-debounced-session-autosave";
import { DEFAULT_TEMPLATE_ID, isTemplateId } from "@/lib/templates";
import { normalizeSectionTitle } from "@/lib/utils";
import { toast } from "sonner";

function parseJsonOrNull(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { setSessionId, setStep, setSelectedTemplateId, setRawInputs, reset } = usePipelineStore();
  const { setSections, setScores, setFieldAnalysis } = useCvStore();

  useDebouncedSessionAutosave(params.id, { enabled: !loading, delayMs: 2000 });

  useEffect(() => {
    reset();
    useCvStore.getState().reset();
    useUsageStore.getState().reset();

    setSessionId(params.id);

    fetch(`/api/sessions/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((session) => {
        setStep(isWizardStep(session.stage) ? session.stage : "upload");
        setRawInputs(session.rawCvText ?? null, session.jobDesc ?? null);
        setSelectedTemplateId(
          isTemplateId(session.templateId) ? session.templateId : DEFAULT_TEMPLATE_ID,
        );
        if (session.sections) {
          setSections(
            session.sections.map((s: Record<string, unknown>) => ({
              ...s,
              title: normalizeSectionTitle(s.title, s.type),
              aiComments: parseJsonOrNull(s.aiComments),
            }))
          );
        }
        if (session.fieldAnalysis) {
          setFieldAnalysis(parseJsonOrNull(session.fieldAnalysis));
        }
        if (session.scores) {
          setScores(session.scores);
        }
      })
      .catch(() => {
        toast.error("Session not found");
        router.push("/dashboard");
      })
      .finally(() => setLoading(false));
  }, [
    params.id,
    reset,
    router,
    setFieldAnalysis,
    setSections,
    setScores,
    setRawInputs,
    setSelectedTemplateId,
    setSessionId,
    setStep,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <AppBrand href="/dashboard" showTagline={false} />
          </div>
          <UserMenu />
        </div>
      </header>

      <Wizard />
    </div>
  );
}
