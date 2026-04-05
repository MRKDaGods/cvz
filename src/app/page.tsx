"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Target,
  MessageSquare,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GithubIcon } from "@/components/icons/github";
import { AppBrand } from "@/components/layout/app-brand";
import { SetupBanner } from "@/components/layout/setup-banner";

const features = [
  {
    icon: Target,
    title: "ATS-Optimized",
    desc: "Passes every ATS scanner. Keyword optimization with real-time scoring.",
  },
  {
    icon: Sparkles,
    title: "MAANG-Grade Templates",
    desc: "Battle-tested LaTeX templates used by engineers at top companies.",
  },
  {
    icon: MessageSquare,
    title: "AI Section Feedback",
    desc: "Targeted suggestions for every section. Accept, refine, or override.",
  },
  {
    icon: Zap,
    title: "Job-Tailored",
    desc: "Paste a job description and your CV transforms to match.",
  },
  {
    icon: CheckCircle2,
    title: "STAR Method",
    desc: "Bullets rewritten with quantified impact using the STAR framework.",
  },
  {
    icon: FileText,
    title: "LaTeX Output",
    desc: "Pristine PDF output compiled from LaTeX. Download source or PDF.",
  },
];

const steps = [
  { step: "1", title: "Upload", desc: "PDF or paste text" },
  { step: "2", title: "Review", desc: "AI extracts sections" },
  { step: "3", title: "Template", desc: "Pick your layout" },
  { step: "4", title: "Optimize", desc: "AI rewrites & scores" },
  { step: "5", title: "Download", desc: "Get your LaTeX PDF" },
];

interface AccountInfo {
  githubUsername: string;
  avatarUrl: string | null;
}

export default function LandingPage() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.accounts?.length) return;
        const active = data.accounts.find((a: { isActive: boolean }) => a.isActive) ?? data.accounts[0];
        if (active) setAccount(active);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <SetupBanner />
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <AppBrand href="/" showTagline={false} />
          {checked && (
            account ? (
              <Button size="sm" onClick={() => router.push("/dashboard")} variant="default">
                <Avatar size="sm" className="mr-2">
                  {account.avatarUrl && (
                    <AvatarImage src={account.avatarUrl} alt={account.githubUsername} />
                  )}
                  <AvatarFallback>{account.githubUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                Dashboard
              </Button>
            ) : (
              <Button size="sm" onClick={() => router.push("/login")} variant="default">
                <GithubIcon className="mr-2 h-4 w-4" />
                Sign in
              </Button>
            )
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container mx-auto px-6 pt-20 pb-16 text-center">
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Powered by GitHub Copilot
            </div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl leading-[1.15]">
              Your CV, rewritten for{" "}
              <span className="text-primary">
                top companies
              </span>
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
              Upload your resume, paste a job description, and get an ATS-optimized,
              LaTeX-typeset CV with AI feedback on every section.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button onClick={() => router.push(account ? "/dashboard" : "/login")}>
                {account ? "Go to Dashboard" : "Get Started"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" nativeButton={false} render={<a href="https://github.com/MRKDaGods/CvOptimizZer" target="_blank" rel="noopener noreferrer" />}>
                <GithubIcon className="mr-2 h-4 w-4" />
                GitHub
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-6 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-lg border bg-card p-5 transition-colors hover:bg-accent/50"
              >
                <f.icon className="h-5 w-5 mb-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                <h3 className="text-sm font-medium mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-t bg-muted/30 py-16">
          <div className="container mx-auto px-6">
            <h2 className="text-lg font-medium text-center mb-10 text-muted-foreground">How it works</h2>
            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
              {steps.map((s, i) => (
                <div key={s.step} className="flex items-start gap-3 text-left max-w-[160px]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-6 text-center text-xs text-muted-foreground">
          Built with Next.js, GitHub Copilot SDK, and LaTeX
        </div>
      </footer>
    </div>
  );
}
