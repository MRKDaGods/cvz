import { NextRequest, NextResponse } from "next/server";
import { getActiveAccount, verifySessionOwner } from "@/lib/auth/session";
import { getCopilotClient } from "@/lib/copilot/client";
import { createPipelineSession } from "@/lib/copilot/session";
import { sendAndWait } from "@/lib/stream/sse";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const account = await getActiveAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, model } = await request.json();

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  if (!(await verifySessionOwner(sessionId))) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    const dbSession = await db.session.findUnique({
      where: { id: sessionId },
      include: { sections: { orderBy: { order: "asc" } } },
    });
    if (!dbSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sections = dbSession.sections.map((s) => ({
      type: s.type,
      title: s.title,
      content: s.optimizedContent ?? s.originalContent,
    }));

    const client = await getCopilotClient(account.accessToken, account.id);
    const session = await createPipelineSession(client, {
      systemPrompt: `You are an expert career gap analyst. Analyze the candidate's CV and identify:
1. Employment gaps (periods without work between roles)
2. Skill gaps compared to their target role or industry standard
3. Missing CV sections that would strengthen their application
4. Areas where experience is thin or needs reinforcement

For each gap found, provide:
- description: what the gap is
- severity: "minor" | "moderate" | "critical"
- suggestion: how to address it

Return JSON: { "gaps": [{ "type": "employment|skill|section|experience", "description": string, "severity": string, "suggestion": string }] }`,
      model,
    });

    const result = await sendAndWait(
      session,
      `Analyze these CV sections for gaps:\n${JSON.stringify(sections)}\n\nJob description: ${dbSession.jobDesc ?? "General software engineering role"}`
    );

    try {
      return NextResponse.json(JSON.parse(result));
    } catch {
      return NextResponse.json({ gaps: [], raw: result });
    }
  } catch (error) {
    console.error("Gap analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to analyze gaps", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
