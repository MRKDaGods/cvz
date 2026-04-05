"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelStore, type PipelineStage } from "@/stores/model-store";

const STAGE_LABELS: Record<PipelineStage, string> = {
  extract: "Extract",
  optimize: "Optimize",
  latex: "LaTeX",
  refine: "Refine",
  smart: "Smart",
};

interface ModelSelectorProps {
  stage: PipelineStage;
  disabled?: boolean;
  className?: string;
}

export function ModelSelector({ stage, disabled, className }: ModelSelectorProps) {
  const models = useModelStore((s) => s.models);
  const modelByStage = useModelStore((s) => s.modelByStage);
  const recommendedByStage = useModelStore((s) => s.recommendedByStage);
  const reasons = useModelStore((s) => s.reasons);
  const loaded = useModelStore((s) => s.loaded);
  const loadModels = useModelStore((s) => s.loadModels);
  const setModelForStage = useModelStore((s) => s.setModelForStage);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const currentModel = modelByStage[stage];
  const recommended = recommendedByStage[stage];
  const reason = reasons[stage];

  if (!loaded || models.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className ?? ""}`}>
        <span className="inline-block h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 ${className ?? ""}`}>
      <span className="shrink-0 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
        {STAGE_LABELS[stage]} model:
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Select
          value={currentModel}
          onValueChange={(val) => val && setModelForStage(stage, val)}
          disabled={disabled}
        >
          <SelectTrigger
            size="sm"
            className="h-8 min-w-[260px] rounded-md border-border/70 bg-background text-xs shadow-sm gap-1.5 px-2.5"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {/* Recommended model first */}
            {recommended && (
              <>
                <SelectItem value={recommended}>
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    {models.find((m) => m.id === recommended)?.name ?? recommended}
                    <span className="text-[10px] text-muted-foreground ml-1">Recommended</span>
                  </span>
                </SelectItem>
                <SelectSeparator />
              </>
            )}
            {/* Other models */}
            {models
              .filter((m) => m.id !== recommended)
              .map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {reason && (
          <div className="max-w-[260px] rounded-md border border-border/50 bg-muted/40 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground shadow-sm">
            <span className="font-medium text-foreground/70">Why this model:</span>{" "}
            <span>{reason}</span>
          </div>
        )}
      </div>
    </div>
  );
}
