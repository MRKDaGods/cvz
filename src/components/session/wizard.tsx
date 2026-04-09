"use client";

import { startTransition } from "react";
import { usePipelineStore, type WizardStep } from "@/stores/pipeline-store";
import { Upload, FileSearch, Layout, Sparkles, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadStep } from "@/components/session/upload-step";
import { ReviewStep } from "@/components/session/review-step";
import { TemplateStep } from "@/components/session/template-step";
import { OptimizeStep } from "@/components/session/optimize-step";
import { FinalizeStep } from "@/components/session/finalize-step";
import { UsageBar } from "@/components/session/usage-bar";

const steps: { id: WizardStep; label: string; icon: typeof Upload }[] = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "review", label: "Review", icon: FileSearch },
  { id: "template", label: "Template", icon: Layout },
  { id: "optimize", label: "Optimize", icon: Sparkles },
  { id: "finalize", label: "Finalize", icon: Download },
];

const stepComponents: Record<WizardStep, React.FC> = {
  upload: UploadStep,
  review: ReviewStep,
  template: TemplateStep,
  optimize: OptimizeStep,
  finalize: FinalizeStep,
};

export function Wizard() {
  const currentStep = usePipelineStore((s) => s.currentStep);
  const maxStep = usePipelineStore((s) => s.maxStep);
  const setStep = usePipelineStore((s) => s.setStep);
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const maxIndex = steps.findIndex((s) => s.id === maxStep);
  const StepComponent = stepComponents[currentStep];

  const handleStepClick = (step: WizardStep, index: number) => {
    if (index > maxIndex || step === currentStep) return;

    startTransition(() => {
      setStep(step);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
        <div className="container mx-auto flex-1 px-6 py-8">
        <nav className="sticky top-16 z-40 mb-8 overflow-x-auto">
          <ol className="flex min-w-max items-center gap-1 sm:justify-center">
            {steps.map((step, i) => {
              const isActive = step.id === currentStep;
              const isDone = i < currentIndex;
              const isReachable = i <= maxIndex;
              return (
                <li key={step.id} className="flex items-center gap-1">
                  {i > 0 && (
                    <div
                      className={cn(
                        "h-px w-6 sm:w-10",
                        isDone ? "bg-foreground/30" : "bg-border"
                      )}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!isReachable}
                    onClick={() => handleStepClick(step.id, i)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      isReachable && "cursor-pointer",
                      isActive && "bg-foreground text-background",
                      isDone && "text-foreground hover:bg-accent",
                      !isActive && !isDone && "text-muted-foreground/60",
                      !isReachable && "cursor-not-allowed",
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <step.icon className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <StepComponent />
      </div>

      <div className="sticky bottom-0 z-40">
        <UsageBar />
      </div>
    </div>
  );
}
