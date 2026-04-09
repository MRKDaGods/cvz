"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CV_TEMPLATE_OPTIONS, type TemplateId } from "@/lib/templates";

interface TemplatePickerProps {
  selected: TemplateId;
  onSelect: (templateId: TemplateId) => void;
  compact?: boolean;
  disabled?: boolean;
}

function MiniLine({ className }: { className?: string }) {
  return <div className={cn("h-1 rounded-full bg-foreground/25", className)} />;
}

function TemplateMiniPreview({
  templateId,
  compact,
}: {
  templateId: TemplateId;
  compact: boolean;
}) {
  const frameHeight = compact ? "h-24" : "h-28";
  const chromeClass = compact ? "mb-2" : "mb-2.5";

  return (
    <div className={cn("rounded-md border bg-muted/20 p-2", chromeClass)} aria-hidden="true">
      <div className={cn("mx-auto w-full max-w-[210px] rounded-sm border bg-background p-2", frameHeight)}>
        {templateId === "classic" ? (
          <div className="flex h-full flex-col gap-1.5">
            <MiniLine className="h-1.5 w-1/2 bg-foreground/40" />
            <MiniLine className="w-full" />
            <div className="h-px w-full bg-foreground/20" />
            <MiniLine className="w-1/3" />
            <MiniLine className="w-full" />
            <MiniLine className="w-11/12" />
            <MiniLine className="w-1/3" />
            <MiniLine className="w-full" />
          </div>
        ) : null}

        {templateId === "modern" ? (
          <div className="flex h-full gap-1.5">
            <div className="w-1/3 rounded-sm bg-sky-500/15 p-1.5">
              <MiniLine className="w-full bg-sky-700/30" />
              <MiniLine className="mt-1 w-4/5 bg-sky-700/25" />
              <MiniLine className="mt-2 w-full bg-sky-700/30" />
              <MiniLine className="mt-1 w-3/4 bg-sky-700/25" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <MiniLine className="h-1.5 w-2/3 bg-sky-700/35" />
              <MiniLine className="w-full" />
              <MiniLine className="w-11/12" />
              <MiniLine className="w-1/2" />
              <MiniLine className="w-full" />
            </div>
          </div>
        ) : null}

        {templateId === "executive" ? (
          <div className="flex h-full flex-col gap-1.5">
            <MiniLine className="h-1.5 w-3/5 bg-foreground/45" />
            <MiniLine className="w-1/2" />
            <div className="rounded-sm bg-foreground/10 p-1.5">
              <MiniLine className="w-full" />
              <MiniLine className="mt-1 w-11/12" />
            </div>
            <MiniLine className="w-1/3" />
            <MiniLine className="w-full" />
            <MiniLine className="w-10/12" />
          </div>
        ) : null}

        {templateId === "academic" ? (
          <div className="flex h-full flex-col gap-1.5">
            <MiniLine className="h-1.5 w-1/2 bg-indigo-700/35" />
            <MiniLine className="w-1/3 bg-indigo-700/25" />
            <MiniLine className="w-full" />
            <MiniLine className="w-10/12" />
            <div className="mt-0.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-foreground/30" />
                <MiniLine className="w-full" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-foreground/30" />
                <MiniLine className="w-11/12" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TemplatePicker({
  selected,
  onSelect,
  compact = false,
  disabled = false,
}: TemplatePickerProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", compact && "gap-3") }>
      {CV_TEMPLATE_OPTIONS.map((template) => {
        const isSelected = selected === template.id;

        return (
          <button
            key={template.id}
            type="button"
            className="text-left disabled:cursor-not-allowed"
            onClick={() => onSelect(template.id)}
            disabled={disabled}
          >
            <Card
              className={cn(
                "h-full cursor-pointer transition-all",
                compact ? "py-2" : "",
                isSelected
                  ? "border-foreground ring-1 ring-foreground"
                  : "hover:bg-accent",
                disabled && "opacity-70",
              )}
            >
              <CardHeader className={cn(compact ? "px-3 pb-2" : "pb-3")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className={cn(compact ? "text-sm" : "text-sm font-medium")}>{template.name}</CardTitle>
                  </div>
                  {isSelected ? (
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="h-3 w-3" />
                    </div>
                  ) : null}
                </div>
                <TemplateMiniPreview templateId={template.id} compact={compact} />
                <CardDescription className="text-xs">{template.description}</CardDescription>
              </CardHeader>
              <CardContent className={cn(compact ? "px-3" : "") }>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Best for: {template.bestFor}
                </span>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}