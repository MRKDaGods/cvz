"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useCvStore } from "@/stores/cv-store";
import { SectionCard } from "@/components/cv/section-card";
import { FieldAnalysisCard } from "@/components/cv/field-analysis-card";
import { JsonViewerButton } from "@/components/session/json-viewer";
import { toast } from "sonner";

export function ReviewStep() {
  const sessionId = usePipelineStore((s) => s.activeSessionId);
  const setStep = usePipelineStore((s) => s.setStep);
  const sections = useCvStore((s) => s.sections);
  const fieldAnalysis = useCvStore((s) => s.fieldAnalysis);
  const stageStatus = usePipelineStore((s) => s.stageStatus);
  const isExtracting = stageStatus["extract"] === "running";

  const handleContinue = async () => {
    // Save sections to server
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "template" }),
      });
      setStep("template");
    } catch {
      toast.error("Failed to save progress");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <h2 className="text-lg font-medium">Review Extracted Sections</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Verify the AI correctly identified your CV sections before optimization.
        </p>
      </div>

      <div className="flex justify-end">
        <JsonViewerButton stage="extract" label="View Extract JSON" />
      </div>

      {fieldAnalysis && <FieldAnalysisCard data={fieldAnalysis} />}

      {isExtracting ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No sections extracted. Go back and upload your CV.
        </div>
      ) : (
        <div className="space-y-5">
          {sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <SectionCard key={section.id} section={section} mode="review" />
            ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("upload")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={sections.length === 0}>
          Choose Template
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
