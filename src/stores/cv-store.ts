import { create } from "zustand";

export interface CvSection {
  id: string;
  type: string;
  title: string;
  originalContent: string;
  optimizedContent: string | null;
  latexContent: string | null;
  aiComments: AiComment[] | null;
  userNotes: string | null;
  order: number;
}

export interface AiComment {
  text: string;
  fix?: string; // Concrete rewrite suggestion from the LLM
  severity: "suggestion" | "important" | "critical";
  category: "impact" | "keywords" | "formatting" | "content" | "clarity" | "ats";
  bulletIndex?: number; // Pin to a specific bullet (0-indexed)
  applied?: boolean; // true = change already made in content, user just needs to verify
  question?: string; // Personalized question to ask the user for context when applying this fix
}

export interface FieldAnalysis {
  domain: string;
  seniority: "intern" | "junior" | "mid" | "senior" | "lead" | "principal" | "executive";
  primarySkills: string[];
  yearsOfExperience: number | null;
  professionalYears: number | null;
  internshipYears: number | null;
  isCareerChanger: boolean;
  careerTrajectory: "ascending" | "lateral" | "pivoting" | "mixed";
  hasInternships: boolean;
  hasMixedExperience: boolean;
}

export interface Scores {
  atsBefore: number;
  atsAfter: number;
  jobFitBefore: number;
  jobFitAfter: number;
  qualityBefore: number;
  qualityAfter: number;
  tierBefore: string;
  tierAfter: string;
}

interface CvState {
  sections: CvSection[];
  selectedSectionId: string | null;
  scores: Scores | null;
  fieldAnalysis: FieldAnalysis | null;
  showOriginal: boolean;

  setSections: (sections: CvSection[]) => void;
  updateSection: (id: string, data: Partial<CvSection>) => void;
  selectSection: (id: string | null) => void;
  setScores: (scores: Scores | null) => void;
  setFieldAnalysis: (fa: FieldAnalysis | null) => void;
  toggleOriginal: () => void;
  reset: () => void;
}

export const useCvStore = create<CvState>((set) => ({
  sections: [],
  selectedSectionId: null,
  scores: null,
  fieldAnalysis: null,
  showOriginal: false,

  setSections: (sections) => set({ sections }),
  updateSection: (id, data) =>
    set((state) => ({
      sections: state.sections.map((s) => (s.id === id ? { ...s, ...data } : s)),
    })),
  selectSection: (id) => set({ selectedSectionId: id }),
  setScores: (scores) => set({ scores }),
  setFieldAnalysis: (fieldAnalysis) => set({ fieldAnalysis }),
  toggleOriginal: () => set((state) => ({ showOriginal: !state.showOriginal })),
  reset: () =>
    set({
      sections: [],
      selectedSectionId: null,
      scores: null,
      fieldAnalysis: null,
      showOriginal: false,
    }),
}));
