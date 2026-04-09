"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  RefreshCw,
  ArrowRight,
  Terminal,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DependencyStatus {
  name: string;
  status: "ok" | "missing" | "error";
  version?: string;
  detail?: string;
  installHint?: string;
}

interface CheckResult {
  ready: boolean;
  dependencies: DependencyStatus[];
}

type InstallTarget = "latex" | "npm" | "prisma";

export default function SetupPage() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<InstallTarget | null>(null);
  const [installOutput, setInstallOutput] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup/check");
      const data = (await res.json()) as CheckResult;
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const handleInstall = async (target: InstallTarget) => {
    setInstalling(target);
    setInstallOutput(null);
    try {
      const res = await fetch("/api/setup/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = (await res.json()) as { success: boolean; output: string };
      setInstallOutput(data.output);
      if (data.success) {
        // Re-check after successful install
        await runCheck();
      }
    } catch (err) {
      setInstallOutput(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstalling(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const missingCount = result?.dependencies.filter((d) => d.status !== "ok").length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight">Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Check that all dependencies are installed before using CVZ.
          </p>
        </div>

        {loading && !result ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking dependencies...
          </div>
        ) : result ? (
          <>
            {/* Status summary */}
            <div className="mb-6 flex items-center gap-3">
              {result.ready ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    All dependencies are installed — you&rsquo;re ready to go!
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {missingCount} missing {missingCount === 1 ? "dependency" : "dependencies"}
                  </span>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={runCheck}
                disabled={loading}
              >
                <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
                Re-check
              </Button>
            </div>

            {/* Dependency list */}
            <div className="space-y-2">
              {result.dependencies.map((dep) => (
                <Card
                  key={dep.name}
                  className={cn(
                    "transition-colors",
                    dep.status !== "ok" && "border-amber-200 dark:border-amber-800"
                  )}
                >
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {dep.status === "ok" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <CardTitle className="text-sm font-medium">{dep.name}</CardTitle>
                        {dep.version && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                            {dep.version.length > 60 ? dep.version.slice(0, 60) + "…" : dep.version}
                          </Badge>
                        )}
                      </div>
                      {dep.status === "ok" && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 text-green-600 dark:text-green-400">
                          Installed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  {dep.status !== "ok" && (
                    <CardContent className="pt-0 pb-3 px-4">
                      {dep.detail && (
                        <p className="text-xs text-muted-foreground mb-2">{dep.detail}</p>
                      )}
                      {dep.installHint && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 rounded bg-muted px-2 py-1">
                            <Terminal className="h-3 w-3 text-muted-foreground shrink-0" />
                            <code className="text-xs font-mono truncate">{dep.installHint}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 ml-auto shrink-0"
                              onClick={() => copyToClipboard(dep.installHint!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          {/* Auto-install button for supported targets */}
                          {dep.installHint.startsWith("npm") && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleInstall("npm")}
                              disabled={installing !== null}
                            >
                              {installing === "npm" ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              Install
                            </Button>
                          )}
                          {dep.installHint.startsWith("npx prisma") && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleInstall("prisma")}
                              disabled={installing !== null}
                            >
                              {installing === "prisma" ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              Run
                            </Button>
                          )}
                          {(dep.installHint.startsWith("winget") ||
                            dep.installHint.startsWith("brew") ||
                            dep.installHint.startsWith("sudo") ||
                            dep.installHint.startsWith("mpm") ||
                            dep.installHint.startsWith("tlmgr")) && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleInstall("latex")}
                              disabled={installing !== null}
                            >
                              {installing === "latex" ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              Install
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {/* Install output */}
            {installOutput && (
              <Card className="mt-4">
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    Install Output
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-4">
                  <pre className="text-[11px] font-mono bg-muted rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap">
                    {installOutput}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Environment variables guide */}
            {result.dependencies.some(
              (d) => d.status !== "ok" && d.detail?.includes(".env.local")
            ) && (
              <Card className="mt-4 border-blue-200 dark:border-blue-800">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium">Environment Variables</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Create a <code className="text-[11px] bg-muted px-1 rounded">.env.local</code> file
                    in the project root with the following variables:
                  </p>
                  <div className="relative">
                    <pre className="text-[11px] font-mono bg-muted rounded p-2 whitespace-pre-wrap">{`DATABASE_URL="file:./dev.db"

# GitHub OAuth App (create at github.com/settings/applications/new)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/callback

# Session encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=your_64_char_hex_string

# Optional defaults
COPILOT_MODEL=gpt-4.1
DEBUG_PIPELINE=false`}</pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() =>
                        copyToClipboard(
                          `DATABASE_URL="file:./dev.db"\n\nGITHUB_CLIENT_ID=your_client_id\nGITHUB_CLIENT_SECRET=your_client_secret\nGITHUB_CALLBACK_URL=http://localhost:3000/api/auth/callback\n\nSESSION_SECRET=your_64_char_hex_string\n\nCOPILOT_MODEL=gpt-4.1\nDEBUG_PIPELINE=false`
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Continue button */}
            {result.ready && (
              <div className="mt-6 flex justify-end">
                <Button nativeButton={false} render={<Link href="/" />}>
                    Continue to CVZ
                    <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-red-500">Failed to check dependencies.</p>
        )}
      </div>
    </div>
  );
}
