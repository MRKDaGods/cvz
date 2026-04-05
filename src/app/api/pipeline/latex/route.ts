import { NextRequest, NextResponse } from "next/server";
import { getActiveAccount, verifySessionOwner } from "@/lib/auth/session";
import { getCopilotClient } from "@/lib/copilot/client";
import { createPipelineSession } from "@/lib/copilot/session";
import { createSSEFromSession } from "@/lib/stream/sse";
import { db } from "@/lib/db";
import { debug } from "@/lib/debug";
import { resolveTargetPageCount } from "@/lib/latex/compiler";
import { parseSectionContent } from "@/lib/utils";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  const account = await getActiveAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, model } = await request.json();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    if (!(await verifySessionOwner(sessionId))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const dbSession = await db.session.findUnique({
      where: { id: sessionId },
      include: { sections: { orderBy: { order: "asc" } } },
    });
    if (!dbSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { generateLatexPrompt } = await import("@/lib/pipeline/prompts");
    const targetPageCount = resolveTargetPageCount(dbSession.fieldAnalysis);

    debug.pipeline(`[latex] Starting for session ${sessionId}, template: ${dbSession.templateId}`);

    // Read the selected template (sanitize templateId to prevent path traversal)
    const templateDir = path.join(process.cwd(), "templates");
    const safeTemplateId = dbSession.templateId.replace(/[^a-zA-Z0-9_-]/g, "");
    const templateFile = path.join(templateDir, `${safeTemplateId}.tex`);
    let templateSource: string;
    try {
      const resolved = path.resolve(templateFile);
      if (!resolved.startsWith(path.resolve(templateDir))) throw new Error("Invalid template");
      templateSource = await fs.readFile(resolved, "utf-8");
    } catch {
      templateSource = ""; // Will work without template
    }

    const optimizedCv = JSON.stringify(
      dbSession.sections.map((s) => {
        const payload = parseSectionContent(s.optimizedContent ?? s.originalContent);
        return {
          type: s.type,
          title: s.title,
          content: payload.content,
          entries: payload.entries,
        };
      })
    );

    const client = await getCopilotClient(account.accessToken, account.id);
    const prompt = generateLatexPrompt(
      optimizedCv,
      dbSession.templateId,
      templateSource,
      targetPageCount,
    );
    debug.pipeline(`[latex] ${dbSession.sections.length} sections, template source: ${templateSource ? templateSource.length + " chars" : "none"}`);
    const session = await createPipelineSession(client, { systemPrompt: prompt, model });

    return createSSEFromSession(
      session,
      "Generate the complete compilable LaTeX document. Output ONLY the LaTeX source code, no markdown fences.",
      {
        onComplete: async (fullText) => {
          // Strip markdown fences if present
          const latex = fullText
            .replace(/^```(?:latex)?\n?/, "")
            .replace(/\n?```$/, "")
            .trim();

          await db.session.update({
            where: { id: sessionId },
            data: { latexSource: latex, stage: "finalize" },
          });
        },
      }
    );
  } catch (error) {
    console.error("LaTeX generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate LaTeX", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
