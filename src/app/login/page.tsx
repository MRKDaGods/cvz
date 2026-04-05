"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GithubIcon } from "@/components/icons/github";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppBrand } from "@/components/layout/app-brand";
import { SetupBanner } from "@/components/layout/setup-banner";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SetupBanner />
      <div className="flex flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <AppBrand showTagline />
          </div>
          <CardTitle className="text-lg font-medium">Sign in</CardTitle>
          <CardDescription className="text-sm">
            Connect your GitHub account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Authentication failed: {error}
            </div>
          )}
          <Button className="w-full" nativeButton={false} render={<a href="/api/auth/github" />}>
              <GithubIcon className="mr-2 h-4 w-4" />
              Continue with GitHub
          </Button>
          <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
            Requires a GitHub Copilot subscription for AI features.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
