"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Zap, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUsageStore, getTotals, type StageUsage } from "@/stores/usage-store";
import { cn } from "@/lib/utils";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}

function StageRow({ name, usage }: { name: string; usage: StageUsage }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium capitalize">{name}</span>
        <span className="text-muted-foreground truncate">{usage.model}</span>
      </div>
      <div className="flex items-center gap-3 tabular-nums text-muted-foreground shrink-0">
        <span>{formatTokens(usage.inputTokens)} in</span>
        <span>{formatTokens(usage.outputTokens)} out</span>
        {usage.durationMs > 0 && <span>{formatDuration(usage.durationMs)}</span>}
        {usage.cost > 0 && <span className="text-foreground">{usage.cost.toFixed(2)}×</span>}
      </div>
    </div>
  );
}

export function UsageBar() {
  const stages = useUsageStore((s) => s.stages);
  const quota = useUsageStore((s) => s.quota);
  const [expanded, setExpanded] = useState(false);

  const stageEntries = Object.entries(stages);
  const hasUsage = stageEntries.length > 0;
  const hasQuota = quota !== null;

  if (!hasUsage && !hasQuota) return null;

  const totals = getTotals(stages);
  const quotaPct = quota ? Math.round(quota.remainingPercentage * 100) : null;
  const quotaUsedPct = quotaPct !== null ? 100 - quotaPct : null;

  return (
    <div className="border-t bg-background/80 backdrop-blur-sm">
      {/* Collapsed summary row */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-6 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Activity className="h-3 w-3" />
          {hasUsage && (
            <span className="tabular-nums">
              {formatTokens(totals.totalTokens)} tokens
              {totals.durationMs > 0 && <> · {formatDuration(totals.durationMs)}</>}
              {totals.cost > 0 && <> · {totals.cost.toFixed(2)}× cost</>}
            </span>
          )}
          {hasQuota && !quota.isUnlimitedEntitlement && (
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              {quota.usedRequests}/{quota.entitlementRequests} requests
            </span>
          )}
          {hasQuota && quota.isUnlimitedEntitlement && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Unlimited
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {stageEntries.length > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
              {stageEntries.length} {stageEntries.length === 1 ? "call" : "calls"}
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-6 py-2 space-y-2">
          {/* Quota bar */}
          {hasQuota && !quota.isUnlimitedEntitlement && quotaUsedPct !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Copilot Plan Usage</span>
                <span className={cn(
                  "tabular-nums",
                  quotaUsedPct > 90 ? "text-red-500" : quotaUsedPct > 70 ? "text-orange-500" : "text-muted-foreground"
                )}>
                  {quota.usedRequests} / {quota.entitlementRequests} requests ({quotaPct}% remaining)
                </span>
              </div>
              <Progress
                value={quotaUsedPct}
                className={cn(
                  "h-1",
                  quotaUsedPct > 90 && "[&_[data-slot=progress-indicator]]:bg-red-500",
                  quotaUsedPct > 70 && quotaUsedPct <= 90 && "[&_[data-slot=progress-indicator]]:bg-orange-500",
                )}
              />
              {quota.resetDate && (
                <p className="text-[10px] text-muted-foreground">
                  Resets {new Date(quota.resetDate).toLocaleDateString()}
                </p>
              )}
              {quota.overage > 0 && (
                <p className="text-[10px] text-orange-600 dark:text-orange-400">
                  {quota.overage} request{quota.overage !== 1 ? "s" : ""} over limit
                </p>
              )}
            </div>
          )}

          {/* Per-stage breakdown */}
          {stageEntries.length > 0 && (
            <div className="divide-y">
              {stageEntries.map(([name, usage]) => (
                <StageRow key={name} name={name} usage={usage} />
              ))}
            </div>
          )}

          {/* Totals */}
          {stageEntries.length > 1 && (
            <div className="flex items-center justify-between text-[11px] pt-1 border-t font-medium">
              <span>Total</span>
              <div className="flex items-center gap-3 tabular-nums">
                <span>{formatTokens(totals.inputTokens)} in</span>
                <span>{formatTokens(totals.outputTokens)} out</span>
                {totals.durationMs > 0 && <span>{formatDuration(totals.durationMs)}</span>}
                {totals.cost > 0 && <span>{totals.cost.toFixed(2)}×</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
