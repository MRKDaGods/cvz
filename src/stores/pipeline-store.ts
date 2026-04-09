import { create } from "zustand";
import { DEFAULT_TEMPLATE_ID, type TemplateId } from "@/lib/templates";

export type WizardStep = "upload" | "review" | "template" | "optimize" | "finalize";

export type StageStatus = "idle" | "running" | "done" | "error";

const STEP_ORDER: WizardStep[] = ["upload", "review", "template", "optimize", "finalize"];

function getStepIndex(step: WizardStep): number {
  return STEP_ORDER.indexOf(step);
}

export function isWizardStep(value: unknown): value is WizardStep {
  return typeof value === "string" && STEP_ORDER.includes(value as WizardStep);
}

interface PipelineState {
  currentStep: WizardStep;
  maxStep: WizardStep;
  activeSessionId: string | null;
  selectedTemplateId: TemplateId;
  stageStatus: Record<string, StageStatus>;
  stageResponses: Record<string, string>;
  streamingText: string;
  error: string | null;
  rawCvText: string | null;
  jobDesc: string | null;

  setStep: (step: WizardStep) => void;
  setSessionId: (id: string | null) => void;
  setSelectedTemplateId: (id: TemplateId) => void;
  setRawInputs: (rawCvText: string | null, jobDesc: string | null) => void;
  setStageStatus: (stage: string, status: StageStatus) => void;
  setStageResponse: (stage: string, response: string) => void;
  appendStreamingText: (text: string) => void;
  clearStreamingText: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  currentStep: "upload",
  maxStep: "upload",
  activeSessionId: null,
  selectedTemplateId: DEFAULT_TEMPLATE_ID,
  stageStatus: {},
  stageResponses: {},
  streamingText: "",
  error: null,
  rawCvText: null,
  jobDesc: null,

  setStep: (step) =>
    set((state) => ({
      currentStep: step,
      maxStep: getStepIndex(step) > getStepIndex(state.maxStep) ? step : state.maxStep,
    })),
  setSessionId: (id) => set({ activeSessionId: id }),
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
  setRawInputs: (rawCvText, jobDesc) => set({ rawCvText, jobDesc }),
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
      maxStep: "upload",
      activeSessionId: null,
      selectedTemplateId: DEFAULT_TEMPLATE_ID,
      stageStatus: {},
      stageResponses: {},
      streamingText: "",
      error: null,
      rawCvText: null,
      jobDesc: null,
    }),
}));
