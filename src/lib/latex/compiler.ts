import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { PDFParse } from "pdf-parse";

export interface CompileResult {
  success: boolean;
  pdfPath?: string;
  pageCount?: number;
  log?: string;
  error?: string;
}

interface LoadedPdf {
  numPages?: number;
}

interface PdfParseWithLoad {
  load: () => Promise<LoadedPdf>;
  destroy?: () => Promise<void>;
}

function sanitizeSessionId(id: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores (cuid format)
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function resolveTargetPageCount(fieldAnalysis: string | null): number {
  if (!fieldAnalysis) return 1;

  try {
    const parsed = JSON.parse(fieldAnalysis) as { seniority?: string };
    if (
      parsed.seniority === "lead" ||
      parsed.seniority === "principal" ||
      parsed.seniority === "executive"
    ) {
      return 2;
    }
  } catch {
    return 1;
  }

  return 1;
}

async function getPdfPageCount(pdfFile: string): Promise<number | undefined> {
  const buffer = await fs.readFile(pdfFile);
  const parser = new PDFParse({ data: buffer }) as unknown as PdfParseWithLoad;

  try {
    const document = await parser.load();
    return typeof document.numPages === "number" ? document.numPages : undefined;
  } catch {
    return undefined;
  } finally {
    if (parser.destroy) {
      await parser.destroy().catch(() => undefined);
    }
  }
}

export async function compileLatex(
  latexSource: string,
  sessionId: string
): Promise<CompileResult> {
  const safeId = sanitizeSessionId(sessionId);
  if (!safeId) return { success: false, error: "Invalid session ID" };
  const tempDir = path.join(os.tmpdir(), "cvz", safeId);
  const texFile = path.join(tempDir, "cv.tex");
  const pdfFile = path.join(tempDir, "cv.pdf");

  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(texFile, latexSource, "utf-8");

    const result = await runLatexmk(texFile, tempDir);

    if (result.exitCode === 0) {
      // Check if PDF was created
      try {
        await fs.access(pdfFile);
        const pageCount = await getPdfPageCount(pdfFile);
        return { success: true, pdfPath: pdfFile, pageCount };
      } catch {
        return { success: false, log: result.output, error: "PDF not generated" };
      }
    }

    return { success: false, log: result.output, error: "Compilation failed" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function runLatexmk(
  texFile: string,
  cwd: string
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(
      "latexmk",
      ["-pdf", "-interaction=nonstopmode", "-halt-on-error", texFile],
      { cwd }
    );

    let output = "";
    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (output += data.toString()));

    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 1, output });
    });

    proc.on("error", (err) => {
      resolve({ exitCode: 1, output: err.message });
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      proc.kill();
      resolve({ exitCode: 1, output: output + "\nTimed out after 60 seconds" });
    }, 60000);
  });
}

export function parseLatexErrors(log: string): string[] {
  const errors: string[] = [];
  const lines = log.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("!")) {
      errors.push(line);
      // Include context lines
      if (i + 1 < lines.length) errors.push(lines[i + 1]);
      if (i + 2 < lines.length && lines[i + 2].startsWith("l.")) {
        errors.push(lines[i + 2]);
      }
    }
  }

  return errors;
}

export async function getPdfPath(sessionId: string): Promise<string | null> {
  const safeId = sanitizeSessionId(sessionId);
  if (!safeId) return null;
  const pdfFile = path.join(os.tmpdir(), "cvz", safeId, "cv.pdf");
  try {
    await fs.access(pdfFile);
    return pdfFile;
  } catch {
    return null;
  }
}
