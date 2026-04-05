"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface CheckResult {
  ready: boolean;
  dependencies: { name: string; status: string }[];
}

/**
 * Shows a thin warning banner when dependencies are missing.
 * Checks once on mount and caches the result for the session.
 */
export function SetupBanner() {
  const [missing, setMissing] = useState<number | null>(null);

  useEffect(() => {
    // Don't re-check on every navigation
    const cached = sessionStorage.getItem("cvz-setup-ok");
    if (cached === "1") return;

    fetch("/api/setup/check")
      .then((r) => (r.ok ? (r.json() as Promise<CheckResult>) : null))
      .then((data) => {
        if (!data) return;
        if (data.ready) {
          sessionStorage.setItem("cvz-setup-ok", "1");
          return;
        }
        const count = data.dependencies.filter((d) => d.status !== "ok").length;
        setMissing(count);
      })
      .catch(() => {});
  }, []);

  if (missing === null || missing === 0) return null;

  return (
    <a
      href="/setup"
      className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
    >
      <AlertTriangle className="h-3 w-3" />
      {missing} missing {missing === 1 ? "dependency" : "dependencies"} — click to set up
    </a>
  );
}
