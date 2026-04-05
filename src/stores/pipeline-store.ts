import { create } from "zustand";
import { DEFAULT_TEMPLATE_ID, type TemplateId } from "@/lib/templates";

export type WizardStep = "upload" | "review" | "template" | "optimize" | "finalize";

export type StageStatus = "idle" | "running" | "done" | "error";

interface PipelineState {
  currentStep: WizardStep;
  activeSessionId: string | null;
  selectedTemplateId: TemplateId;
  stageStatus: Record<string, StageStatus>;
  stageResponses: Record<string, string>;
  streamingText: string;
  error: string | null;

  setStep: (step: WizardStep) => void;
  setSessionId: (id: string | null) => void;
  setSelectedTemplateId: (id: TemplateId) => void;
  setStageStatus: (stage: string, status: StageStatus) => void;
  setStageResponse: (stage: string, response: string) => void;
  appendStreamingText: (text: string) => void;
  clearStreamingText: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  currentStep: "upload",
  activeSessionId: null,
  selectedTemplateId: DEFAULT_TEMPLATE_ID,
  stageStatus: {},
  stageResponses: {},
  streamingText: "",
  error: null,

  setStep: (step) => set({ currentStep: step }),
  setSessionId: (id) => set({ activeSessionId: id }),
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
  setStageStatus: (stage, status) =>
    set((state) => ({
      stageStatus: { ...state.stageStatus, [stage]: status },
    })),
  setStageResponse: (stage, response) =>
    set((state) => ({
      stageResponses: { ...state.stageResponses, [stage]: response },
    })),
  appendStreamingText: (text) =>
    set((state) => ({ streamingText: state.streamingText + text })),
  clearStreamingText: () => set({ streamingText: "" }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      currentStep: "upload",
      activeSessionId: null,
      selectedTemplateId: DEFAULT_TEMPLATE_ID,
      stageStatus: {},
      stageResponses: {},
      streamingText: "",
      error: null,
    }),
}));
