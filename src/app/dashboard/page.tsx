"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppBrand } from "@/components/layout/app-brand";
import { UserMenu } from "@/components/layout/user-menu";
import { toast } from "sonner";

interface SessionItem {
  id: string;
  title: string;
  stage: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
}

const stageLabels: Record<string, string> = {
  upload: "Upload",
  review: "Review",
  template: "Template",
  optimize: "Optimize",
  finalize: "Finalize",
};

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions ?? []))
      .catch(() => toast.error("Failed to load sessions"))
      .finally(() => setLoading(false));
  }, []);

  const createSession = async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New CV" }),
      });
      const session = await res.json();
      router.push(`/session/${session.id}`);
    } catch {
      toast.error("Failed to create session");
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      setSessions((s) => s.filter((x) => x.id !== id));
      toast.success("Session deleted");
    } catch {
      toast.error("Failed to delete session");
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <AppBrand href="/dashboard" showTagline={false} />
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-medium">Your CVs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create, optimize, and manage your resumes.
            </p>
          </div>
          <Button size="sm" onClick={createSession}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            New CV
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium mb-1">No CVs yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first AI-optimized CV in minutes.
            </p>
            <Button size="sm" onClick={createSession}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create your first CV
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <Card
                key={s.id}
                className="group cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() => router.push(`/session/${s.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-medium">{s.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 -mt-1 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CardDescription className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {stageLabels[s.stage] ?? s.stage}
                    </span>
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="h-3 w-3" />
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </span>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
