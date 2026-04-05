import { create } from "zustand";

export interface StageUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  durationMs: number;
}

/** Copilot plan quota snapshot (from assistant.usage quotaSnapshots) */
export interface QuotaSnapshot {
  isUnlimitedEntitlement: boolean;
  entitlementRequests: number;
  usedRequests: number;
  remainingPercentage: number;
  resetDate: string | null;
  overage: number;
}

interface UsageState {
  /** Per-pipeline-stage usage (extract, optimize, latex, refine, etc.) */
  stages: Record<string, StageUsage>;
  /** Latest Copilot plan quota snapshot from any stage */
  quota: QuotaSnapshot | null;

  /** Record usage from an assistant.usage event for a stage */
  addStageUsage: (stage: string, usage: StageUsage) => void;
  /** Update quota from assistant.usage quotaSnapshots */
  setQuota: (quota: QuotaSnapshot) => void;
  /** Reset everything (new session) */
  reset: () => void;
}

export const useUsageStore = create<UsageState>((set) => ({
  stages: {},
  quota: null,

  addStageUsage: (stage, usage) =>
    set((s) => ({
      stages: {
        ...s.stages,
        [stage]: s.stages[stage]
          ? {
              model: usage.model,
              inputTokens: s.stages[stage].inputTokens + usage.inputTokens,
              outputTokens: s.stages[stage].outputTokens + usage.outputTokens,
              cacheReadTokens: s.stages[stage].cacheReadTokens + usage.cacheReadTokens,
              cacheWriteTokens: s.stages[stage].cacheWriteTokens + usage.cacheWriteTokens,
              cost: s.stages[stage].cost + usage.cost,
              durationMs: s.stages[stage].durationMs + usage.durationMs,
            }
          : usage,
      },
    })),

  setQuota: (quota) => set({ quota }),

  reset: () => set({ stages: {}, quota: null }),
}));

/** Computed totals across all stages */
export function getTotals(stages: Record<string, StageUsage>) {
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  let durationMs = 0;
  for (const s of Object.values(stages)) {
    inputTokens += s.inputTokens;
    outputTokens += s.outputTokens;
    cost += s.cost;
    durationMs += s.durationMs;
  }
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost, durationMs };
}
