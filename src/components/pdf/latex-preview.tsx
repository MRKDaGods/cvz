"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContextualLoader } from "@/components/ui/contextual-loader";

// react-pdf requires pdf.js worker — use CDN to avoid bundling issues
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface LatexPreviewProps {
  pdfUrl: string | null;
  compiling: boolean;
}

const COMPILING_MESSAGES = [
  "Formatting LaTeX layout...",
  "Compiling PDF pages...",
  "Resolving references and spacing...",
];

const PDF_LOADING_MESSAGES = [
  "Loading generated PDF...",
  "Rendering preview pages...",
];

export function LatexPreview({ pdfUrl, compiling }: LatexPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoadError(null);
  }, []);

  const onLoadError = useCallback((error: Error) => {
    setLoadError(error.message);
  }, []);

  // Measure container width for responsive PDF scaling
  const observerRef = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(node);
      observerRef.current = observer;
      setContainerWidth(node.clientWidth);
    }
  }, []);

  // Reset on URL change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNumPages(null);
    setLoadError(null);
  }, [pdfUrl]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (compiling) {
    return (
      <ContextualLoader messages={COMPILING_MESSAGES} />
    );
  }

  if (!pdfUrl) {
    return null;
  }

  if (loadError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Failed to load PDF preview</p>
        <p className="text-xs mt-1">{loadError}</p>
        {/* Fallback to iframe */}
        <iframe src={pdfUrl} className="w-full h-[600px] rounded border mt-4" title="CV Preview" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <Document
        file={pdfUrl}
        onLoadSuccess={onLoadSuccess}
        onLoadError={onLoadError}
        loading={
          <ContextualLoader
            messages={PDF_LOADING_MESSAGES}
            className="py-10"
            iconClassName="h-6 w-6"
            messageClassName="text-xs"
          />
        }
      >
        {numPages &&
          Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i}
              pageNumber={i + 1}
              width={containerWidth > 0 ? containerWidth : undefined}
              className="mb-4 shadow-sm rounded overflow-hidden"
            />
          ))}
      </Document>
      {numPages && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {numPages} page{numPages > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
