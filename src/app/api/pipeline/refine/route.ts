import { NextRequest, NextResponse } from "next/server";
import { getActiveAccount, verifySessionOwner } from "@/lib/auth/session";
import { getCopilotClient } from "@/lib/copilot/client";
import { createPipelineSession } from "@/lib/copilot/session";
import { createSSEFromSession } from "@/lib/stream/sse";
import { db } from "@/lib/db";
import { debug } from "@/lib/debug";

export async function POST(request: NextRequest) {
  const account = await getActiveAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { sessionId, model } = body;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  if (!(await verifySessionOwner(sessionId))) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // --- Fit-to-page mode: condense LaTeX to fit within page limit ---
  if (body.fitToPage) {
    const { currentLatex, pageCount, pageLimit } = body;
    if (!currentLatex || !pageCount || !pageLimit) {
      return NextResponse.json({ error: "Missing fitToPage fields" }, { status: 400 });
    }

    try {
      debug.pipeline(`[refine] Fit-to-page: ${pageCount} → ${pageLimit} pages`);
      const { refineLatexPrompt } = await import("@/lib/pipeline/prompts");
      const client = await getCopilotClient(account.accessToken, account.id);
      const prompt = refineLatexPrompt(currentLatex, pageLimit, pageCount);
      const session = await createPipelineSession(client, { systemPrompt: prompt, model });

      return createSSEFromSession(
        session,
        `This LaTeX document compiles to ${pageCount} pages but MUST be exactly ${pageLimit} page(s). Apply the checklist aggressively — reduce spacing, shrink font to 9pt if needed, condense or remove low-value entries. Return ONLY the updated LaTeX source code, starting with \\documentclass and ending with \\end{document}.`
      );
    } catch (error) {
      console.error("Fit-to-page failed:", error);
      return NextResponse.json(
        { error: "Failed to condense document" },
        { status: 500 }
      );
    }
  }

  // --- Fix LaTeX errors mode ---
  if (body.fixErrors) {
    const { currentLatex, errors } = body;
    if (!currentLatex || !errors) {
      return NextResponse.json({ error: "Missing fixErrors fields" }, { status: 400 });
    }

    try {
      debug.pipeline(`[refine] Fix LaTeX errors: ${Array.isArray(errors) ? errors.length : 0} errors`);
      const { fixLatexErrorsPrompt } = await import("@/lib/pipeline/prompts");
      const client = await getCopilotClient(account.accessToken, account.id);
      const errorText = Array.isArray(errors) ? errors.join("\n") : String(errors);
      const prompt = fixLatexErrorsPrompt(currentLatex, errorText);
      const session = await createPipelineSession(client, { systemPrompt: prompt, model });

      return createSSEFromSession(
        session,
        "Fix these LaTeX compilation errors. Return ONLY the corrected LaTeX source code, starting with \\documentclass and ending with \\end{document}."
      );
    } catch (error) {
      console.error("Fix-errors failed:", error);
      return NextResponse.json(
        { error: "Failed to fix errors" },
        { status: 500 }
      );
    }
  }

  // --- Standard section refinement ---
  const {
    sectionType,
    currentContent,
    userInstructions,
    aiComments,
    requestMode,
  } = body;

  if (!sectionType || !currentContent) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    debug.pipeline(`[refine] Starting for section type: ${sectionType}, session: ${sessionId}`);
    const { refineSectionPrompt } = await import("@/lib/pipeline/prompts");

    // Fetch other sections so the LLM has full CV context
    let cvContext: string | undefined;
    try {
      const allSections = await db.cvSection.findMany({
        where: { sessionId },
        select: { type: true, title: true, optimizedContent: true, originalContent: true },
      });
      const otherSections = allSections.filter((s) => s.type !== sectionType);
      if (otherSections.length > 0) {
        cvContext = otherSections
          .map((s) => `[${s.type}] ${s.title}\n${s.optimizedContent ?? s.originalContent}`)
          .join("\n\n");
      }
    } catch (err) {
      debug.pipeline("[refine] Failed to fetch CV context (non-fatal):", err instanceof Error ? err.message : String(err));
    }

    const client = await getCopilotClient(account.accessToken, account.id);
    const prompt = refineSectionPrompt(
      currentContent,
      sectionType,
      userInstructions ?? "",
      aiComments ?? "[]",
      requestMode === "ask" ? "ask" : "rewrite",
      cvContext,
    );
    const session = await createPipelineSession(client, { systemPrompt: prompt, model });

    return createSSEFromSession(
      session,
      requestMode === "ask"
        ? "Answer the user's question about this section. Return JSON with 'content', 'aiComments', 'assistantMessage', and 'changeSummary' fields. Keep 'content' unchanged unless the user explicitly asked for a rewrite."
        : "Refine this section according to the instructions. Return JSON with 'content', 'aiComments', 'assistantMessage', and 'changeSummary' fields.",
    );
  } catch (error) {
    console.error("Section refinement failed:", error);
    return NextResponse.json(
      { error: "Failed to refine section", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
