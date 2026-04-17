import { NextResponse } from "next/server";
import { exec } from "child_process";
import { existsSync } from "fs";
import fs from "fs/promises";
import os from "os";
import { dirname, isAbsolute, join } from "path";

interface InstallRequest {
  target: "latex" | "npm" | "prisma";
}

const WINDOWS_TEMPLATE_WARMUP_DOC = String.raw`\documentclass[10pt,letterpaper]{article}
\usepackage[
  letterpaper,
  top=0.4in,
  bottom=0.4in,
  left=0.5in,
  right=0.5in
]{geometry}
\usepackage{helvet}
\renewcommand{\familydefault}{\sfdefault}
\usepackage[T1]{fontenc}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{fontawesome5}
\usepackage{microtype}
\usepackage{xcolor}
\usepackage{ragged2e}
\usepackage[sfdefault]{cabin}
\usepackage{charter}
\usepackage{lmodern}
\usepackage[
  colorlinks=true,
  urlcolor=blue,
  linkcolor=blue,
  pdfborder={0 0 0}
]{hyperref}
\begin{document}
CVZ template package warmup.
\end{document}
`;

function runCommand(
  cmd: string,
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number }
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    exec(
      cmd,
      {
        timeout: options?.timeout ?? 300000,
        cwd: options?.cwd,
        env: options?.env,
      },
      (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, output: (stderr || err.message).slice(-2000) });
      } else {
        resolve({ ok: true, output: (stdout || "").slice(-2000) });
      }
      }
    );
  });
}

function getWindowsLatexCandidates(command: "initexmf" | "pdflatex"): string[] {
  const localAppData = process.env.LOCALAPPDATA;
  const userProfile = process.env.USERPROFILE;

  const candidates = [
    localAppData ? join(localAppData, "Programs", "MiKTeX", "miktex", "bin", "x64", `${command}.exe`) : null,
    userProfile
      ? join(userProfile, "AppData", "Local", "Programs", "MiKTeX", "miktex", "bin", "x64", `${command}.exe`)
      : null,
    join("C:\\Program Files", "MiKTeX", "miktex", "bin", "x64", `${command}.exe`),
    join("C:\\Program Files", "MiKTeX 2.9", "miktex", "bin", "x64", `${command}.exe`),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return Array.from(new Set(candidates));
}

function resolveWindowsLatexCommand(command: "initexmf" | "pdflatex"): string {
  const candidates = getWindowsLatexCandidates(command).filter((candidate) => existsSync(candidate));
  return candidates[0] ?? command;
}

function createWindowsLatexEnv(commands: string[]): NodeJS.ProcessEnv {
  const currentPath = process.env.PATH ?? process.env.Path ?? "";
  const pathParts = currentPath.split(";").filter(Boolean);

  for (const command of commands) {
    if (!isAbsolute(command)) {
      continue;
    }

    const commandDir = dirname(command);
    const normalizedDir = commandDir.toLowerCase();
    const existsInPath = pathParts.some((part) => part.toLowerCase() === normalizedDir);
    if (!existsInPath) {
      pathParts.unshift(commandDir);
    }
  }

  return {
    ...process.env,
    PATH: pathParts.join(";"),
  };
}

async function runWindowsTemplateWarmup(): Promise<{ ok: boolean; output: string }> {
  const initexmf = resolveWindowsLatexCommand("initexmf");
  const pdflatex = resolveWindowsLatexCommand("pdflatex");
  const env = createWindowsLatexEnv([initexmf, pdflatex]);
  const output: string[] = [];

  const autoInstall = await runCommand(`"${initexmf}" --set-config-value=[MPM]AutoInstall=1`, {
    env,
    timeout: 30000,
  });
  output.push(
    autoInstall.ok
      ? "Configured MiKTeX AutoInstall=1"
      : `AutoInstall configuration warning: ${autoInstall.output}`
  );

  const warmupDir = join(os.tmpdir(), "cvz-latex-setup");
  const warmupFile = join(warmupDir, "warmup.tex");
  await fs.mkdir(warmupDir, { recursive: true });
  await fs.writeFile(warmupFile, WINDOWS_TEMPLATE_WARMUP_DOC, "utf-8");

  const compileResult = await runCommand(
    `"${pdflatex}" -interaction=nonstopmode -halt-on-error "warmup.tex"`,
    { cwd: warmupDir, env, timeout: 120000 }
  );
  if (!compileResult.ok) {
    output.push(compileResult.output);
    return { ok: false, output: output.join("\n") };
  }

  output.push("Template package warmup compile succeeded");
  return { ok: true, output: output.join("\n") };
}

function getLatexInstallCommand(): string | null {
  if (process.platform === "win32") {
    return "winget install MiKTeX.MiKTeX --accept-package-agreements --accept-source-agreements";
  }
  if (process.platform === "darwin") {
    return "brew install --cask mactex-no-gui";
  }
  if (process.platform === "linux") {
    return "sudo apt-get install -y texlive-full latexmk";
  }
  return null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as InstallRequest;

  switch (body.target) {
    case "npm": {
      const result = await runCommand("npm install");
      return NextResponse.json({
        success: result.ok,
        output: result.output,
      });
    }

    case "prisma": {
      const result = await runCommand("npx prisma db push");
      return NextResponse.json({
        success: result.ok,
        output: result.output,
      });
    }

    case "latex": {
      const cmd = getLatexInstallCommand();
      if (!cmd) {
        return NextResponse.json(
          { success: false, output: `Unsupported platform: ${process.platform}` },
          { status: 400 }
        );
      }
      const result = await runCommand(cmd);

      if (process.platform === "win32") {
        const warmup = await runWindowsTemplateWarmup();
        return NextResponse.json({
          success: warmup.ok,
          output: [
            `MiKTeX install command result:\n${result.output}`,
            `Template warmup result:\n${warmup.output}`,
          ].join("\n\n"),
        });
      }

      return NextResponse.json({
        success: result.ok,
        output: result.output,
      });
    }

    default:
      return NextResponse.json(
        { success: false, output: "Unknown install target" },
        { status: 400 }
      );
  }
}
