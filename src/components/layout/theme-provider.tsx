"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useUiStore } from "@/stores/ui-store";

function applyTheme(theme: "light" | "dark" | "system") {
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const theme = useUiStore((s) => s.theme);

  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    // Restore saved preference into store
    const saved = localStorage.getItem("cvz-theme") as "light" | "dark" | "system" | null;
    if (saved) {
      useUiStore.getState().setTheme(saved);
    }
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Apply theme whenever store changes
  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    localStorage.setItem("cvz-theme", theme);
  }, [theme, mounted]);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (useUiStore.getState().theme === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mounted]);

  if (!mounted) return <>{children}</>;
  return <>{children}</>;
}
