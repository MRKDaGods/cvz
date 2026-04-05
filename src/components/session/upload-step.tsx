"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, FileText, Clipboard, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useCvStore } from "@/stores/cv-store";
import { useModelStore } from "@/stores/model-store";
import { useUsageStore } from "@/stores/usage-store";
import { useStreaming } from "@/hooks/use-streaming";
import { ModelSelector } from "@/components/session/model-selector";
import { StreamingOutput } from "@/components/session/streaming-output";
import { JsonViewerButton } from "@/components/session/json-viewer";
import { normalizeSectionTitle, serializeSectionContent, extractJSON } from "@/lib/utils";
import { toast } from "sonner";

export function UploadStep() {
  const [cvText, setCvText] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = usePipelineStore((s) => s.activeSessionId);
  const setStep = usePipelineStore((s) => s.setStep);
  const setStageResponse = usePipelineStore((s) => s.setStageResponse);
  const setSections = useCvStore((s) => s.setSections);
  const setFieldAnalysis = useCvStore((s) => s.setFieldAnalysis);
  const getModel = useModelStore((s) => s.getModel);
  const addStageUsage = useUsageStore((s) => s.addStageUsage);
  const setQuota = useUsageStore((s) => s.setQuota);

  const streaming = useStreaming({
    onComplete: (content) => {
      setStageResponse("extract", content);
      try {
        const result = extractJSON(content);
        const resultSections = (Array.isArray(result.sections) ? result.sections : []) as Record<string, unknown>[];
        setSections(
          resultSections.map((s, i) => ({
            id: `temp-${i}`,
            type: String(s.type ?? "other"),
            title: normalizeSectionTitle(s.title as string | undefined, s.type as string | undefined),
              originalContent: serializeSectionContent(
                (s.content || s.fields || "") as string,
                Array.isArray(s.entries) ? s.entries as Record<string, unknown>[] : undefined,
              ),
            optimizedContent: null,
            latexContent: null,
            aiComments: null,
            userNotes: null,
            order: i,
          }))
        );
        if (result.fieldAnalysis) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fa = result.fieldAnalysis as any;
          // LLMs sometimes return "fullTimeYears" instead of "professionalYears"
          if (fa.professionalYears == null && fa.fullTimeYears != null) {
            fa.professionalYears = fa.fullTimeYears;
            delete fa.fullTimeYears;
          }
          setFieldAnalysis(fa);
        }
        setStep("review");
        toast.success("CV sections extracted!");
      } catch {
        toast.error("Failed to parse extraction result");
      }
    },
    onError: (error) => toast.error(error),
    onUsage: (u) => {
      addStageUsage("extract", u);
      if (u.quota) setQuota(u.quota);
    },
  });

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/pipeline/parse-pdf", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Failed to parse PDF");
        const { text } = await res.json();
        setCvText(text);
        toast.success(`Extracted text from ${file.name}`);
      } catch {
        toast.error("Failed to parse PDF");
        setFileName(null);
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const handleExtract = useCallback(() => {
    if (!cvText.trim()) {
      toast.error("Please upload a CV or paste text first");
      return;
    }
    // Save to session first
    fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawCvText: cvText, jobDesc: jobDesc || null }),
    });

    streaming.start("/api/pipeline/extract", {
      sessionId,
      cvText,
      jobDesc: jobDesc || null,
      model: getModel("extract"),
    });
  }, [cvText, jobDesc, sessionId, streaming, getModel]);

  const isLoading = streaming.status === "streaming" || uploading;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-medium">Upload Your CV</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a PDF or paste your CV text. Optionally add a job description.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* CV Input */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Your CV</CardTitle>
            <CardDescription className="text-xs">Upload a PDF or paste raw text</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upload">
              <TabsList className="w-full">
                <TabsTrigger value="upload" className="flex-1">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload PDF
                </TabsTrigger>
                <TabsTrigger value="paste" className="flex-1">
                  <Clipboard className="mr-2 h-4 w-4" />
                  Paste Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <div
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 cursor-pointer transition-colors hover:border-primary hover:bg-accent/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  )}
                  <p className="mt-1.5 text-sm font-medium">
                    {fileName ?? "Click to upload PDF"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">PDF up to 10MB</p>
                </div>
                {cvText && fileName && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {cvText.length} characters extracted
                  </p>
                )}
              </TabsContent>

              <TabsContent value="paste" className="mt-4">
                <Textarea
                  placeholder="Paste your CV text here... Include everything: education, work experience, skills, projects, certifications, etc."
                  className="min-h-[200px] resize-y"
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Job Description (Optional) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Job Description</CardTitle>
            <CardDescription className="text-xs">
              Optional. Provide a JD to tailor your CV for a specific role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="jobdesc" className="sr-only">
              Job Description
            </Label>
            <Textarea
              id="jobdesc"
              placeholder="Paste the job description here... The AI will optimize your CV to match this role's requirements."
              className="min-h-[244px] resize-y"
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
            />
            {jobDesc && (
              <p className="mt-2 text-xs text-muted-foreground">
                {jobDesc.length} characters
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Streaming output */}
      <StreamingOutput
        status={streaming.status}
        content={streaming.content}
        thinking={streaming.thinking}
        label="Extracting sections..."
        showPreview
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ModelSelector stage="extract" disabled={isLoading} />
          <JsonViewerButton stage="extract" />
        </div>
        <Button onClick={handleExtract} disabled={!cvText.trim() || isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              Extract & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
