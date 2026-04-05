import { NextResponse } from "next/server";
import { exec } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

interface DependencyStatus {
  name: string;
  status: "ok" | "missing" | "error";
  version?: string;
  detail?: string;
  installHint?: string;
}

function checkCommand(cmd: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    exec(`${cmd} ${args.join(" ")}`, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, output: stderr || err.message });
      } else {
        resolve({ ok: true, output: stdout.trim() });
      }
    });
  });
}

export async function GET() {
  const deps: DependencyStatus[] = [];

  // 1. Node.js (always present since we're running)
  deps.push({
    name: "Node.js",
    status: "ok",
    version: process.version,
  });

  // 2. @github/copilot-sdk — check if installed
  const sdkPath = join(process.cwd(), "node_modules", "@github", "copilot-sdk", "dist", "index.js");
  const cliPath = join(process.cwd(), "node_modules", "@github", "copilot", "index.js");
  if (existsSync(sdkPath) && existsSync(cliPath)) {
    deps.push({
      name: "Copilot SDK",
      status: "ok",
      detail: "@github/copilot-sdk + @github/copilot installed",
    });
  } else {
    deps.push({
      name: "Copilot SDK",
      status: "missing",
      detail: "Run npm install to install dependencies",
      installHint: "npm install",
    });
  }

  // 3. latexmk
  const latexmk = await checkCommand("latexmk", ["--version"]);
  if (latexmk.ok) {
    const versionLine = latexmk.output.split("\n")[0] ?? "";
    deps.push({
      name: "LaTeX (latexmk)",
      status: "ok",
      version: versionLine,
    });
  } else {
    deps.push({
      name: "LaTeX (latexmk)",
      status: "missing",
      detail: "Required for PDF compilation",
      installHint: process.platform === "win32"
        ? "winget install MiKTeX.MiKTeX"
        : process.platform === "darwin"
          ? "brew install --cask mactex-no-gui"
          : "sudo apt-get install texlive-full latexmk",
    });
  }

  // 4. pdflatex (part of LaTeX distribution)
  const pdflatex = await checkCommand("pdflatex", ["--version"]);
  if (pdflatex.ok) {
    const versionLine = pdflatex.output.split("\n")[0] ?? "";
    deps.push({
      name: "pdflatex",
      status: "ok",
      version: versionLine,
    });
  } else {
    deps.push({
      name: "pdflatex",
      status: "missing",
      detail: "Included with LaTeX distribution (MiKTeX / TeX Live / MacTeX)",
    });
  }

  // 5. Environment variables
  const envVars = [
    { key: "GITHUB_CLIENT_ID", label: "GitHub OAuth Client ID" },
    { key: "GITHUB_CLIENT_SECRET", label: "GitHub OAuth Client Secret" },
    { key: "GITHUB_CALLBACK_URL", label: "GitHub OAuth Callback URL" },
    { key: "SESSION_SECRET", label: "Session encryption key" },
  ];

  for (const { key, label } of envVars) {
    deps.push({
      name: label,
      status: process.env[key] ? "ok" : "missing",
      detail: process.env[key] ? "Configured" : `Set ${key} in .env.local`,
    });
  }

  // 6. Database (prisma sqlite)
  const dbPath = join(process.cwd(), "dev.db");
  if (existsSync(dbPath)) {
    deps.push({
      name: "Database",
      status: "ok",
      detail: "SQLite database exists",
    });
  } else {
    deps.push({
      name: "Database",
      status: "missing",
      detail: "Run npx prisma db push to create the database",
      installHint: "npx prisma db push",
    });
  }

  const allOk = deps.every((d) => d.status === "ok");

  return NextResponse.json({ ready: allOk, dependencies: deps });
}
