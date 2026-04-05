"use client";

import { useState } from "react";
import { Code2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePipelineStore } from "@/stores/pipeline-store";

interface JsonViewerButtonProps {
  stage: string;
  label?: string;
}

export function JsonViewerButton({ stage, label }: JsonViewerButtonProps) {
  const response = usePipelineStore((s) => s.stageResponses[stage]);
  const [open, setOpen] = useState(false);

  if (!response) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Code2 className="h-3 w-3" />
        {label ?? "View JSON"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              {stage} — Raw Response
            </DialogTitle>
          </DialogHeader>
          <JsonContent content={response} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function JsonContent({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    formatted = content;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {content.length.toLocaleString()} chars
        </span>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="flex-1 min-h-0 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap break-all">
        {formatted}
      </pre>
    </div>
  );
}
