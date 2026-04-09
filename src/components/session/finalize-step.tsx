"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Download, FileCode, Loader2, RefreshCw, Scissors, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useCvStore } from "@/stores/cv-store";
import { useModelStore } from "@/stores/model-store";
import { SectionCard } from "@/components/cv/section-card";
import { SmartInsights } from "@/components/cv/smart-insights";
import { ModelSelector } from "@/components/session/model-selector";
import { StreamingOutput } from "@/components/session/streaming-output";
import { JsonViewerButton } from "@/components/session/json-viewer";
import { TemplatePicker } from "@/components/session/template-picker";
import { useStreaming } from "@/hooks/use-streaming";
import { useUsageStore } from "@/stores/usage-store";
import { getTemplateOption, type TemplateId } from "@/lib/templates";
import { toast } from "sonner";

const LatexPreview = dynamic(
  () => import("@/components/pdf/latex-preview").then((m) => m.LatexPreview),
  { ssr: false }
);

export function FinalizeStep() {
  const sessionId = usePipelineStore((s) => s.activeSessionId);
  const selectedTemplateId = usePipelineStore((s) => s.selectedTemplateId);
  const setStep = usePipelineStore((s) => s.setStep);
  const setSelectedTemplateId = usePipelineStore((s) => s.setSelectedTemplateId);
  const sections = useCvStore((s) => s.sections);
  const getModel = useModelStore((s) => s.getModel);
  const setStageResponse = usePipelineStore((s) => s.setStageResponse);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [latexSource, setLatexSource] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [pageInfo, setPageInfo] = useState<{ pageCount: number | null; pageLimit: number | null } | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [latexErrors, setLatexErrors] = useState<string[]>([]);
  const [pageOverflow, setPageOverflow] = useState(false);
  const addStageUsage = useUsageStore((s) => s.addStageUsage);
  const setQuota = useUsageStore((s) => s.setQuota);

  const selectedTemplate = getTemplateOption(selectedTemplateId);

  const latexStreaming = useStreaming({
    onComplete: async (content) => {
      setStageResponse("latex", content);
      // The LLM returns LaTeX source — extract it
      const latexMatch = content.match(/```(?:latex)?\n?([\s\S]*?)```/) || [null, content];
      const latex = latexMatch[1]?.trim() ?? content.trim();
      setLatexSource(latex);
      setCompileError(null);

      // Save and compile
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latexSource: latex, stage: "finalize" }),
      });

      compilePdf(latex);
    },
    onError: (error) => toast.error(error),
    onUsage: (u) => {
      addStageUsage("latex", u);
      if (u.quota) setQuota(u.quota);
    },
  });

  const fitStreaming = useStreaming({
    onComplete: async (content) => {
      const latexMatch = content.match(/```(?:latex)?\n?([\s\S]*?)```/) || [null, content];
      const newLatex = latexMatch[1]?.trim() ?? content.trim();
      setLatexSource(newLatex);
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latexSource: newLatex }),
      });
      await compilePdf(newLatex);
    },
    onError: (error) => {
      setCompileError(error);
      toast.error(error);
    },
    onUsage: (u) => {
      addStageUsage("latex", u);
      if (u.quota) setQuota(u.quota);
    },
  });

  const fixErrorsStreaming = useStreaming({
    onComplete: async (content) => {
      const latexMatch = content.match(/```(?:latex)?\n?([\s\S]*?)```/) || [null, content];
      const fixedLatex = latexMatch[1]?.trim() ?? content.trim();
      setLatexSource(fixedLatex);
      setLatexErrors([]);
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latexSource: fixedLatex }),
      });
      await compilePdf(fixedLatex);
    },
    onError: (error) => {
      setCompileError(error);
      toast.error(error);
    },
    onUsage: (u) => {
      addStageUsage("latex", u);
      if (u.quota) setQuota(u.quota);
    },
  });

  const compilePdf = useCallback(
    async (latex: string) => {
      setCompiling(true);
      setCompileError(null);
      setLatexErrors([]);
      setPageOverflow(false);
      try {
        const res = await fetch("/api/compile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, latex, model: getModel("latex") }),
        });
        const data = await res.json();
        if (data.success) {
          setPageInfo({
            pageCount: typeof data.pageCount === "number" ? data.pageCount : null,
            pageLimit: typeof data.pageLimit === "number" ? data.pageLimit : null,
          });
          setPdfUrl(`/api/compile/${sessionId}?t=${Date.now()}`);
          if (data.overflow) {
            setPageOverflow(true);
            toast.warning(
              `PDF is ${data.pageCount} page(s) — target is ${data.pageLimit}. You can still download it or try "Fit to page".`
            );
          } else {
            toast.success("PDF compiled successfully!");
          }
        } else {
          setPdfUrl(null);
          if (Array.isArray(data.latexErrors) && data.latexErrors.length > 0) {
            setLatexErrors(data.latexErrors);
          }
          const errorMessage =
            typeof data.pageCount === "number" && typeof data.pageLimit === "number"
              ? `${data.error}. Current output is ${data.pageCount} page${data.pageCount === 1 ? "" : "s"}; target is ${data.pageLimit}.`
              : data.error;
          setCompileError(errorMessage);
          toast.error(errorMessage);
        }
      } catch {
        setCompileError("Failed to compile PDF");
        toast.error("Failed to compile PDF");
      } finally {
        setCompiling(false);
      }
    },
    [sessionId, getModel]
  );

  const persistTemplateSelection = useCallback(
    async (templateId: TemplateId) => {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
    },
    [sessionId],
  );

  const handleGenerateLatex = useCallback(() => {
    setCompileError(null);
    setPageInfo(null);
    setPdfUrl(null);
    setPageOverflow(false);
    setLatexErrors([]);

    void persistTemplateSelection(selectedTemplateId)
      .then(() => {
        void latexStreaming.start("/api/pipeline/latex", {
          sessionId,
          model: getModel("latex"),
        });
      })
      .catch(() => {
        toast.error("Failed to save the selected template");
      });
  }, [sessionId, latexStreaming, getModel, persistTemplateSelection, selectedTemplateId]);

  const handleTemplateSelect = useCallback(
    async (templateId: TemplateId) => {
      if (!sessionId || templateId === selectedTemplateId) return;

      const previousTemplateId = selectedTemplateId;
      setSelectedTemplateId(templateId);

      try {
        await persistTemplateSelection(templateId);
        setCompileError(null);
        setPageInfo(null);

        if (latexSource || pdfUrl) {
          setPdfUrl(null);
          await latexStreaming.start("/api/pipeline/latex", {
            sessionId,
            model: getModel("latex"),
          });
        }
      } catch {
        setSelectedTemplateId(previousTemplateId);
        toast.error("Failed to change template");
      }
    },
    [
      getModel,
      latexSource,
      latexStreaming,
      pdfUrl,
      persistTemplateSelection,
      selectedTemplateId,
      sessionId,
      setSelectedTemplateId,
    ],
  );

  const handleFitToPage = useCallback(() => {
    if (!latexSource || !pageInfo?.pageLimit || !pageInfo.pageCount) return;
    setCompileError(null);
    void fitStreaming.start("/api/pipeline/refine", {
      sessionId,
      model: getModel("latex"),
      fitToPage: true,
      currentLatex: latexSource,
      pageCount: pageInfo.pageCount,
      pageLimit: pageInfo.pageLimit,
    });
  }, [sessionId, latexSource, pageInfo, getModel, fitStreaming]);

  const handleFixErrors = useCallback(() => {
    if (!latexSource || latexErrors.length === 0) return;
    setCompileError(null);
    void fixErrorsStreaming.start("/api/pipeline/refine", {
      sessionId,
      model: getModel("latex"),
      fixErrors: true,
      currentLatex: latexSource,
      errors: latexErrors,
    });
  }, [sessionId, latexSource, latexErrors, getModel, fixErrorsStreaming]);

  const isGenerating = latexStreaming.status === "streaming";
  const isFitting = fitStreaming.status === "streaming";
  const isFixing = fixErrorsStreaming.status === "streaming";
  const isBusy = compiling || isGenerating || isFitting || isFixing;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-medium">Finalize & Download</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generate your LaTeX PDF, switch templates, or refine individual sections.
        </p>
      </div>

      <StreamingOutput
        status={latexStreaming.status}
        content={latexStreaming.content}
        thinking={latexStreaming.thinking}
        label="Generating LaTeX..."
        showPreview
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Sections for refinement */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Sections</h3>
            <JsonViewerButton stage="latex" label="View LaTeX" />
          </div>
          {sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                mode="finalize"
              />
            ))}
        </div>

        {/* Right: PDF Preview & Download */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Preview</h3>
              <p className="text-xs text-muted-foreground">
                Switch layout here without leaving finalize.
              </p>
            </div>
            {pageInfo?.pageCount != null && pageInfo.pageLimit != null ? (
              <Badge variant={pageOverflow ? "destructive" : "outline"}>
                {pageInfo.pageCount}/{pageInfo.pageLimit} pages
              </Badge>
            ) : null}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">{selectedTemplate.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                </div>
                <ModelSelector stage="latex" disabled={isBusy} />
              </div>

              <TemplatePicker
                selected={selectedTemplateId}
                onSelect={handleTemplateSelect}
                compact
                disabled={isBusy}
              />

              <div className="flex justify-end">
                <Button onClick={handleGenerateLatex} disabled={isBusy}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <FileCode className="mr-2 h-4 w-4" />
                      {latexSource ? `Regenerate ${selectedTemplate.name}` : "Generate LaTeX"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              {compileError ? (
                <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2 text-sm text-destructive">
                    <span>{compileError}</span>
                    {latexErrors.length > 0 && latexSource && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleFixErrors}
                        disabled={isBusy}
                        className="shrink-0"
                      >
                        {isFixing ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Wrench className="mr-1 h-3 w-3" />
                        )}
                        Fix with AI
                      </Button>
                    )}
                  </div>
                  {latexErrors.length > 0 && (
                    <pre className="max-h-28 overflow-y-auto rounded bg-destructive/5 p-2 text-[11px] text-destructive/80 whitespace-pre-wrap">
                      {latexErrors.join("\n")}
                    </pre>
                  )}
                </div>
              ) : null}

              {/* Fix-errors streaming output */}
              <StreamingOutput
                status={fixErrorsStreaming.status}
                content={fixErrorsStreaming.content}
                thinking={fixErrorsStreaming.thinking}
                label="Fixing compilation errors..."
                showPreview
              />

              {pageOverflow && pdfUrl ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2.5">
                  <p className="text-sm text-foreground/80">
                    <span className="font-medium text-orange-600 dark:text-orange-400">{pageInfo?.pageCount} pages</span>
                    {" "}— target is {pageInfo?.pageLimit}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFitToPage}
                    disabled={isBusy}
                    className="shrink-0"
                  >
                    {isFitting ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Scissors className="mr-1 h-3 w-3" />
                    )}
                    Fit to page
                  </Button>
                </div>
              ) : null}

              {/* Fit-to-page streaming output */}
              <StreamingOutput
                status={fitStreaming.status}
                content={fitStreaming.content}
                thinking={fitStreaming.thinking}
                label="Condensing to fit page limit..."
                showPreview
              />

              {pdfUrl ? (
                <div className="space-y-4">
                  <LatexPreview pdfUrl={pdfUrl} compiling={false} />
                  <div className="flex gap-2">
                    <Button nativeButton={false} render={<a href={pdfUrl} download={`cv-${sessionId}.pdf`} />} className="flex-1">
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => latexSource && compilePdf(latexSource)}
                      disabled={compiling || !latexSource}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${compiling ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </div>
                </div>
              ) : (
                <LatexPreview pdfUrl={null} compiling={compiling} />
              )}
              {!pdfUrl && !compiling && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileCode className="h-8 w-8 mb-3" />
                  <p className="text-sm">{isGenerating ? "Generating preview..." : "Generate LaTeX to see preview"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* LaTeX Source Download */}
          {latexSource && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">LaTeX Source</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {latexSource.slice(0, 500)}...
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    const blob = new Blob([latexSource], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "cv.tex";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="mr-2 h-3 w-3" />
                  Download .tex
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Smart Insights */}
          {sessionId && <SmartInsights sessionId={sessionId} />}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("optimize")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    </div>
  );
}
