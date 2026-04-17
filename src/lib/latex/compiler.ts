import { spawn } from "child_process";
import { existsSync } from "fs";
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

export async function getPdfPageCount(pdfFile: string): Promise<number | undefined> {
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
    const compileResult =
      result.exitCode === 0 || !shouldFallbackToPdfLatex(result.output)
        ? result
        : await runPdfLatex(texFile, tempDir);

    if (compileResult.exitCode === 0) {
      // Check if PDF was created
      try {
        await fs.access(pdfFile);
        const pageCount = await getPdfPageCount(pdfFile);
        return { success: true, pdfPath: pdfFile, pageCount };
      } catch {
        return { success: false, log: compileResult.output, error: "PDF not generated" };
      }
    }

    return { success: false, log: compileResult.output, error: "Compilation failed" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function resolveLatexmkCommand(): string {
  if (process.platform !== "win32") {
    return "latexmk";
  }

  const localAppData = process.env.LOCALAPPDATA;
  const userProfile = process.env.USERPROFILE;
  const candidates = [
    localAppData
      ? path.join(localAppData, "Programs", "MiKTeX", "miktex", "bin", "x64", "latexmk.exe")
      : null,
    userProfile
      ? path.join(userProfile, "AppData", "Local", "Programs", "MiKTeX", "miktex", "bin", "x64", "latexmk.exe")
      : null,
    path.join("C:\\Program Files", "MiKTeX", "miktex", "bin", "x64", "latexmk.exe"),
    path.join("C:\\Program Files", "MiKTeX 2.9", "miktex", "bin", "x64", "latexmk.exe"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate)) ?? "latexmk";
}

function resolvePdfLatexCommand(): string {
  if (process.platform !== "win32") {
    return "pdflatex";
  }

  const localAppData = process.env.LOCALAPPDATA;
  const userProfile = process.env.USERPROFILE;
  const candidates = [
    localAppData
      ? path.join(localAppData, "Programs", "MiKTeX", "miktex", "bin", "x64", "pdflatex.exe")
      : null,
    userProfile
      ? path.join(userProfile, "AppData", "Local", "Programs", "MiKTeX", "miktex", "bin", "x64", "pdflatex.exe")
      : null,
    path.join("C:\\Program Files", "MiKTeX", "miktex", "bin", "x64", "pdflatex.exe"),
    path.join("C:\\Program Files", "MiKTeX 2.9", "miktex", "bin", "x64", "pdflatex.exe"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate)) ?? "pdflatex";
}

function createLatexEnv(command: string): NodeJS.ProcessEnv {
  const commandDir = path.dirname(command);
  const currentPath = process.env.PATH ?? process.env.Path ?? "";
  const hasCommandDir = currentPath
    .split(path.delimiter)
    .some((entry) => entry.toLowerCase() === commandDir.toLowerCase());

  return {
    ...process.env,
    PATH: hasCommandDir || !path.isAbsolute(command)
      ? currentPath
      : `${commandDir}${path.delimiter}${currentPath}`,
  };
}

function shouldFallbackToPdfLatex(output: string): boolean {
  const lower = output.toLowerCase();
  return (
    lower.includes("script engine 'perl'") ||
    lower.includes("required to execute 'latexmk'") ||
    lower.includes("latexmk") && lower.includes("not found") ||
    lower.includes("enoent")
  );
}

function runSingleLatexCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let output = "";

    const finalize = (exitCode: number, finalOutput: string) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode, output: finalOutput });
    };

    const proc = spawn(command, args, { cwd, env });
    const timeout = setTimeout(() => {
      proc.kill();
      finalize(1, output + "\nTimed out after 60 seconds");
    }, 60000);

    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (output += data.toString()));

    proc.on("close", (code) => {
      clearTimeout(timeout);
      finalize(code ?? 1, output);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      finalize(1, output + (output ? "\n" : "") + err.message);
    });
  });
}

function runLatexmk(
  texFile: string,
  cwd: string
): Promise<{ exitCode: number; output: string }> {
  const latexmkCommand = resolveLatexmkCommand();
  const env = createLatexEnv(latexmkCommand);
  return runSingleLatexCommand(
    latexmkCommand,
    ["-pdf", "-interaction=nonstopmode", "-halt-on-error", texFile],
    cwd,
    env
  );
}

async function runPdfLatex(
  texFile: string,
  cwd: string
): Promise<{ exitCode: number; output: string }> {
  const pdflatexCommand = resolvePdfLatexCommand();
  const env = createLatexEnv(pdflatexCommand);
  const args = ["-interaction=nonstopmode", "-halt-on-error", texFile];

  const passOne = await runSingleLatexCommand(pdflatexCommand, args, cwd, env);
  if (passOne.exitCode !== 0) {
    return passOne;
  }

  const passTwo = await runSingleLatexCommand(pdflatexCommand, args, cwd, env);
  return {
    exitCode: passTwo.exitCode,
    output: [passOne.output, passTwo.output].filter(Boolean).join("\n"),
  };
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
