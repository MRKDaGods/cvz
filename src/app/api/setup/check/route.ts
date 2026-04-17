import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { getGitHubOAuthConfig, isValidSessionSecret } from "@/lib/env";

interface DependencyStatus {
  name: string;
  status: "ok" | "missing" | "error";
  version?: string;
  detail?: string;
  installHint?: string;
}

type LatexCommand = "latexmk" | "pdflatex" | "kpsewhich";

const REQUIRED_TEMPLATE_STY_FILES = [
  { file: "infwarerr.sty", packageId: "infwarerr" },
  { file: "fontawesome5.sty", packageId: "fontawesome5" },
  { file: "cabin.sty", packageId: "cabin" },
  { file: "charter.sty", packageId: "charter" },
  { file: "lmodern.sty", packageId: "lm" },
];

function getWindowsLatexCandidates(command: LatexCommand): string[] {
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

function getCommandCandidates(command: LatexCommand): string[] {
  const fromPath = [command];
  if (process.platform !== "win32") {
    return fromPath;
  }

  const localCandidates = getWindowsLatexCandidates(command).filter((candidate) => existsSync(candidate));
  return [...localCandidates, ...fromPath];
}

function checkCommand(command: LatexCommand, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const candidates = getCommandCandidates(command);
    let index = 0;
    let lastOutput = "";

    const next = () => {
      if (index >= candidates.length) {
        resolve({ ok: false, output: lastOutput || `${command} not found` });
        return;
      }

      const candidate = candidates[index++];
      execFile(candidate, args, { timeout: 10000 }, (err, stdout, stderr) => {
        if (!err) {
          resolve({ ok: true, output: stdout.trim() });
          return;
        }

        const errCode = (err as NodeJS.ErrnoException & { code?: string | number }).code;
        const isEnoent = errCode === "ENOENT";
        lastOutput = stderr || err.message;

        // ENOENT means this candidate command path does not exist in this environment.
        // For any other error, the command was found and executed, so keep this message.
        if (!isEnoent) {
          resolve({ ok: false, output: lastOutput });
          return;
        }

        next();
      });
    };

    next();
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
    const needsPerl = /script engine 'perl'|required to execute 'latexmk'|fix-script-engine-not-found/i.test(
      latexmk.output
    );
    deps.push({
      name: "LaTeX (latexmk)",
      status: "missing",
      detail: needsPerl
        ? "MiKTeX found, but latexmk cannot run because Perl is missing"
        : "Required for PDF compilation",
      installHint: needsPerl
        ? "winget install StrawberryPerl.StrawberryPerl"
        : process.platform === "win32"
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

  // 5. Template package files (required for all template options)
  const kpsewhich = await checkCommand("kpsewhich", ["--version"]);
  if (kpsewhich.ok) {
    const missingTemplateFiles: string[] = [];

    for (const requiredFile of REQUIRED_TEMPLATE_STY_FILES) {
      const lookup = await checkCommand("kpsewhich", [requiredFile.file]);
      if (!lookup.ok || !lookup.output.trim()) {
        missingTemplateFiles.push(`${requiredFile.file} (${requiredFile.packageId})`);
      }
    }

    if (missingTemplateFiles.length === 0) {
      deps.push({
        name: "Template LaTeX packages",
        status: "ok",
        detail: "All required package files are available",
      });
    } else {
      deps.push({
        name: "Template LaTeX packages",
        status: "missing",
        detail: `Missing package files: ${missingTemplateFiles.join(", ")}`,
        installHint:
          process.platform === "win32"
            ? "mpm --install=infwarerr; mpm --install=fontawesome5; mpm --install=cabin; mpm --install=charter; mpm --install=lm"
            : "tlmgr install infwarerr fontawesome5 cabin charter lmodern",
      });
    }
  } else {
    deps.push({
      name: "Template LaTeX packages",
      status: "missing",
      detail: "Could not verify package files with kpsewhich",
      installHint:
        process.platform === "win32"
          ? "mpm --install=infwarerr; mpm --install=fontawesome5; mpm --install=cabin; mpm --install=charter; mpm --install=lm"
          : "tlmgr install infwarerr fontawesome5 cabin charter lmodern",
    });
  }

  // 6. Environment variables
  const githubConfig = getGitHubOAuthConfig();
  deps.push({
    name: "GitHub OAuth Client ID",
    status: githubConfig.clientId ? "ok" : "missing",
    detail: githubConfig.clientId ? "Configured" : "Set GITHUB_CLIENT_ID in .env.local",
  });
  deps.push({
    name: "GitHub OAuth Client Secret",
    status: githubConfig.clientSecret ? "ok" : "missing",
    detail: githubConfig.clientSecret ? "Configured" : "Set GITHUB_CLIENT_SECRET in .env.local",
  });
  deps.push({
    name: "GitHub OAuth Callback URL",
    status: githubConfig.callbackUrl ? "ok" : "missing",
    detail: githubConfig.callbackUrl ? "Configured" : "Set GITHUB_CALLBACK_URL in .env.local",
  });
  const sessionSecret = process.env.SESSION_SECRET;
  deps.push({
    name: "Session encryption key",
    status: isValidSessionSecret(sessionSecret) ? "ok" : "missing",
    detail: isValidSessionSecret(sessionSecret)
      ? "Configured"
      : "Set SESSION_SECRET in .env.local as 64 hex characters",
  });
  deps.push({
    name: "Database URL",
    status: "ok",
    detail: process.env.DATABASE_URL ? "Configured" : "Using default file:./dev.db fallback",
  });

  // 7. Database (prisma sqlite)
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

  const pdflatexReady = deps.some((d) => d.name === "pdflatex" && d.status === "ok");
  const allOk = deps.every((d) =>
    d.status === "ok" || (d.name === "LaTeX (latexmk)" && pdflatexReady)
  );

  return NextResponse.json({ ready: allOk, dependencies: deps });
}
