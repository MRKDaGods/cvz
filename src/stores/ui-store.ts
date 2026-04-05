import { create } from "zustand";

const ASK_DETAILS_KEY = "cvz-ask-for-details";

interface UiState {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  askForDetails: boolean;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setAskForDetails: (v: boolean) => void;
}

function loadAskForDetails(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(ASK_DETAILS_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  theme: "system",
  askForDetails: loadAskForDetails(),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
  setAskForDetails: (v) => {
    try { localStorage.setItem(ASK_DETAILS_KEY, String(v)); } catch { /* quota */ }
    set({ askForDetails: v });
  },
}));
