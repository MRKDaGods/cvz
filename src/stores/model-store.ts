"use client";

import { create } from "zustand";

export type PipelineStage = "extract" | "optimize" | "latex" | "refine" | "smart";

interface ModelInfo {
  id: string;
  name: string;
}

interface StageDefault {
  modelId: string;
  reason: string;
}

interface ModelState {
  models: ModelInfo[];
  modelByStage: Record<PipelineStage, string>;
  recommendedByStage: Record<PipelineStage, string>;
  reasons: Record<PipelineStage, string>;
  loaded: boolean;
  loading: boolean;

  loadModels: () => Promise<void>;
  setModelForStage: (stage: PipelineStage, modelId: string) => void;
  getModel: (stage: PipelineStage) => string;
}

const DEFAULT_MODEL = "gpt-4.1";
const STORAGE_KEY = "cvz-model-choices";

const EMPTY_STAGES: Record<PipelineStage, string> = {
  extract: DEFAULT_MODEL,
  optimize: DEFAULT_MODEL,
  latex: DEFAULT_MODEL,
  refine: DEFAULT_MODEL,
  smart: DEFAULT_MODEL,
};

function loadSaved(): Partial<Record<PipelineStage, string>> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistChoices(choices: Record<PipelineStage, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch { /* quota exceeded – ignore */ }
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  modelByStage: { ...EMPTY_STAGES },
  recommendedByStage: { ...EMPTY_STAGES },
  reasons: { extract: "", optimize: "", latex: "", refine: "", smart: "" },
  loaded: false,
  loading: false,

  loadModels: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch("/api/models");
      if (!res.ok) throw new Error("Failed to fetch models");
      const data: {
        models: ModelInfo[];
        defaults: Record<PipelineStage, StageDefault>;
      } = await res.json();

      const modelByStage = {} as Record<PipelineStage, string>;
      const recommendedByStage = {} as Record<PipelineStage, string>;
      const reasons = {} as Record<PipelineStage, string>;
      for (const stage of Object.keys(data.defaults) as PipelineStage[]) {
        modelByStage[stage] = data.defaults[stage].modelId;
        recommendedByStage[stage] = data.defaults[stage].modelId;
        reasons[stage] = data.defaults[stage].reason;
      }

      // Overlay saved user choices (only if the model still exists)
      const saved = loadSaved();
      const availableIds = new Set(data.models.map((m) => m.id));
      for (const stage of Object.keys(modelByStage) as PipelineStage[]) {
        const savedId = saved[stage];
        if (savedId && availableIds.has(savedId)) {
          modelByStage[stage] = savedId;
        }
      }

      set({
        models: data.models,
        modelByStage,
        recommendedByStage,
        reasons,
        loaded: true,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  setModelForStage: (stage, modelId) =>
    set((s) => {
      const modelByStage = { ...s.modelByStage, [stage]: modelId };
      persistChoices(modelByStage);
      return { modelByStage };
    }),

  getModel: (stage) => get().modelByStage[stage] ?? DEFAULT_MODEL,
}));
