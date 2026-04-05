import { NextResponse } from "next/server";
import { exec } from "child_process";

interface InstallRequest {
  target: "latex" | "npm" | "prisma";
}

function runCommand(cmd: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, output: (stderr || err.message).slice(-2000) });
      } else {
        resolve({ ok: true, output: (stdout || "").slice(-2000) });
      }
    });
  });
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
