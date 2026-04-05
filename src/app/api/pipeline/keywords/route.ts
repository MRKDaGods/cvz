import { NextRequest, NextResponse } from "next/server";
import { getActiveAccount, verifySessionOwner } from "@/lib/auth/session";
import { getCopilotClient } from "@/lib/copilot/client";
import { createPipelineSession } from "@/lib/copilot/session";
import { sendAndWait } from "@/lib/stream/sse";
import { db } from "@/lib/db";
import { debug } from "@/lib/debug";

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

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { sections: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    debug.pipeline(`[keywords] Starting for session ${sessionId}, has JD: ${!!session.jobDesc}`);

    const {
      extractJobDescriptionKeywordsPrompt,
      generalOptimizationPrompt,
    } = await import("@/lib/pipeline/prompts");

    const client = await getCopilotClient(account.accessToken, account.id);

    let prompt: string;
    let userMessage: string;

    if (session.jobDesc) {
      debug.pipeline("[keywords] Using JD-based keyword extraction");
      prompt = extractJobDescriptionKeywordsPrompt(session.jobDesc);
      userMessage = session.jobDesc;
    } else {
      debug.pipeline("[keywords] Using general optimization (no JD)");
      const fieldAnalysis = session.fieldAnalysis
        ? JSON.parse(session.fieldAnalysis)
        : { domain: "Software Engineering", seniority: "Mid-Level", primarySkills: ["Programming"] };
      prompt = generalOptimizationPrompt(fieldAnalysis);
      userMessage = "Generate general optimization keywords for this candidate.";
    }

    const copilotSession = await createPipelineSession(client, { systemPrompt: prompt, model });
    const result = await sendAndWait(copilotSession, userMessage);
    debug.pipeline(`[keywords] Result received (${result.length} chars)`);

    // Save keywords
    await db.session.update({
      where: { id: sessionId },
      data: { keywords: result },
    });

    return NextResponse.json({ keywords: result });
  } catch (error) {
    console.error("Keywords extraction failed:", error);
    return NextResponse.json(
      { error: "Failed to extract keywords", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
