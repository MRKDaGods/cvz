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
      content: s.optimizedContent ?? s.originalContent,
    }));

    const client = await getCopilotClient(account.accessToken, account.id);
    const session = await createPipelineSession(client, {
      systemPrompt: `You are an expert interview coach. Based on the candidate's CV and target role, generate:

1. Behavioral questions they should prepare for (STAR format answers based on their actual experience)
2. Technical topics to review based on their skills and target role
3. Potential weaknesses an interviewer might probe
4. Suggested talking points from their experience that would impress

Return JSON: {
  "behavioral": [{ "question": string, "suggestedAnswer": string, "basedOn": string }],
  "technical": [{ "topic": string, "why": string, "prepTips": string }],
  "weaknesses": [{ "area": string, "howToAddress": string }],
  "talkingPoints": [{ "point": string, "impact": string }]
}`,
      model,
    });

    const result = await sendAndWait(
      session,
      `CV sections:\n${JSON.stringify(sections)}\n\nTarget role: ${dbSession.jobDesc ?? "Software Engineer at a top company"}`
    );

    try {
      return NextResponse.json(JSON.parse(result));
    } catch {
      return NextResponse.json({ raw: result });
    }
  } catch (error) {
    console.error("Interview tips generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate interview tips", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
