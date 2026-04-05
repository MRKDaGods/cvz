import { NextRequest, NextResponse } from "next/server";
import { getActiveAccount, getCurrentUser, verifySessionOwner } from "@/lib/auth/session";
import { getCopilotClient } from "@/lib/copilot/client";
import { createPipelineSession } from "@/lib/copilot/session";
import { sendAndWait } from "@/lib/stream/sse";
import { compileLatex, parseLatexErrors, resolveTargetPageCount } from "@/lib/latex/compiler";
import { db } from "@/lib/db";

const MAX_RETRIES = 5;

function normalizeLatex(text: string): string {
  return text
    .replace(/^```(?:latex)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; latex?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, latex, model } = body;
  if (!sessionId || !latex) {
    return NextResponse.json({ error: "Missing sessionId or latex" }, { status: 400 });
  }

  if (!(await verifySessionOwner(sessionId))) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const dbSession = await db.session.findUnique({
    where: { id: sessionId },
    select: { fieldAnalysis: true },
  });

  if (!dbSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const pageLimit = resolveTargetPageCount(dbSession.fieldAnalysis);

  let currentLatex = latex;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await compileLatex(currentLatex, sessionId);

    if (result.success) {
      if (typeof result.pageCount === "number" && result.pageCount > pageLimit) {
        if (attempt < MAX_RETRIES - 1) {
          try {
            const account = await getActiveAccount();
            if (!account) break;

            const { refineLatexPrompt } = await import("@/lib/pipeline/prompts");
            const client = await getCopilotClient(account.accessToken, account.id);
            const prompt = refineLatexPrompt(currentLatex, pageLimit, result.pageCount);
            const session = await createPipelineSession(client, { systemPrompt: prompt, model: model || undefined });

            const tightened = await sendAndWait(
              session,
              `This LaTeX document compiles to ${result.pageCount} pages but MUST be exactly ${pageLimit} page(s). Apply the checklist aggressively — reduce spacing, shrink font to 9pt if needed, condense or remove low-value entries. Return ONLY the updated LaTeX source code, starting with \\documentclass and ending with \\end{document}.`
            );

            currentLatex = normalizeLatex(tightened);
            continue;
          } catch {
            // Fall through and return the overflow error.
          }
        }

        // Page overflow after all retries — return PDF anyway with a warning
        await db.session.update({
          where: { id: sessionId },
          data: { pdfPath: result.pdfPath, latexSource: currentLatex },
        });
        return NextResponse.json({
          success: true,
          overflow: true,
          pdfPath: result.pdfPath,
          pageCount: result.pageCount,
          pageLimit,
        });
      }

      // Save PDF path
      await db.session.update({
        where: { id: sessionId },
        data: { pdfPath: result.pdfPath, latexSource: currentLatex },
      });
      return NextResponse.json({
        success: true,
        pdfPath: result.pdfPath,
        pageCount: result.pageCount ?? null,
        pageLimit,
      });
    }

    // Try to fix errors with LLM
    if (attempt < MAX_RETRIES - 1 && result.log) {
      const errors = parseLatexErrors(result.log);
      if (errors.length > 0) {
        try {
          const account = await getActiveAccount();
          if (!account) break;

          const { fixLatexErrorsPrompt } = await import("@/lib/pipeline/prompts");
          const client = await getCopilotClient(account.accessToken, account.id);
          const prompt = fixLatexErrorsPrompt(currentLatex, errors.join("\n"));
          const session = await createPipelineSession(client, { systemPrompt: prompt, model: model || undefined });

          const fixed = await sendAndWait(
            session,
            "Fix these LaTeX compilation errors. Return ONLY the corrected LaTeX source code."
          );

          currentLatex = normalizeLatex(fixed);

          continue;
        } catch {
          // LLM fix failed, continue to next attempt
        }
      }
    }

    // All retries exhausted
    const parsedErrors = result.log ? parseLatexErrors(result.log) : [];
    return NextResponse.json({
      success: false,
      error: result.error,
      pageLimit,
      latexErrors: parsedErrors.slice(0, 10),
      log: result.log?.slice(-2000),
    });
  }

  return NextResponse.json({
    success: false,
    error: "Max retries exhausted",
  });
}
