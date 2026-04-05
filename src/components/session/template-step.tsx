"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/stores/pipeline-store";
import { TemplatePicker } from "@/components/session/template-picker";
import { toast } from "sonner";

export function TemplateStep() {
  const sessionId = usePipelineStore((s) => s.activeSessionId);
  const setStep = usePipelineStore((s) => s.setStep);
  const selected = usePipelineStore((s) => s.selectedTemplateId);
  const setSelectedTemplateId = usePipelineStore((s) => s.setSelectedTemplateId);

  const handleContinue = async () => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected, stage: "optimize" }),
      });
      setStep("optimize");
    } catch {
      toast.error("Failed to save template");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-medium">Choose a Template</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick the layout for your optimized CV.
        </p>
      </div>

      <TemplatePicker selected={selected} onSelect={setSelectedTemplateId} />

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("review")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleContinue}>
          Optimize CV
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
