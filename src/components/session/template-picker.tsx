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
                    <CardDescription className="mt-0.5 text-xs">{template.description}</CardDescription>
                  </div>
                  {isSelected ? (
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="h-3 w-3" />
                    </div>
                  ) : null}
                </div>
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