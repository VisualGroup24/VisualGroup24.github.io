import { create } from "zustand";

export type ThemeMode = "light" | "dark";

function initialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem("hka-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

type ThemeState = {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
};

export const useTheme = create<ThemeState>((set) => ({
  mode: initialMode(),
  toggle: () => set((state) => ({ mode: state.mode === "dark" ? "light" : "dark" })),
  setMode: (mode) => set({ mode }),
}));
