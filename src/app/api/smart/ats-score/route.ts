import { NextRequest, NextResponse } from "next/server";
import { getActiveAccount, verifySessionOwner } from "@/lib/auth/session";
import { getCopilotClient } from "@/lib/copilot/client";
import { createPipelineSession } from "@/lib/copilot/session";
import { sendAndWait } from "@/lib/stream/sse";
import { db } from "@/lib/db";
import { toStringArray } from "@/lib/utils";

function normalizeAtsPayload(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const value = data as Record<string, unknown>;
  const keywordMatch = (value.keywordMatch as Record<string, unknown> | undefined) ?? {};
  const formatScore = (value.formatScore as Record<string, unknown> | undefined) ?? {};
  const sectionDetection = (value.sectionDetection as Record<string, unknown> | undefined) ?? {};

  if (typeof value.overallScore !== "number") {
    return null;
  }

  return {
    overallScore: value.overallScore,
    keywordMatch: {
      score: typeof keywordMatch.score === "number" ? keywordMatch.score : 0,
      matched: toStringArray(keywordMatch.matched),
      missing: toStringArray(keywordMatch.missing),
    },
    formatScore: {
      score: typeof formatScore.score === "number" ? formatScore.score : 0,
      issues: toStringArray(formatScore.issues),
    },
    sectionDetection: {
      detected: toStringArray(sectionDetection.detected),
      missing: toStringArray(sectionDetection.missing),
    },
    recommendations: toStringArray(value.recommendations),
  };
}

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
      systemPrompt: `You are an ATS (Applicant Tracking System) simulator. Score this CV as an ATS would:

Evaluate:
1. Keyword match rate against the job description
2. Format compliance (proper section headers, consistent formatting)
3. Contact information completeness
4. Section detection (can ATS parse each section?)
5. Bullet point quality (action verbs, metrics)

Return JSON: {
  "overallScore": number (0-100),
  "keywordMatch": { "score": number, "matched": string[], "missing": string[] },
  "formatScore": { "score": number, "issues": string[] },
  "sectionDetection": { "detected": string[], "missing": string[] },
  "recommendations": string[]
}`,
      model,
    });

    const result = await sendAndWait(
      session,
      `CV:\n${JSON.stringify(sections)}\n\nJob description: ${dbSession.jobDesc ?? "General software engineering role. Key skills: programming, system design, algorithms, data structures, teamwork, communication."}`
    );

    try {
      const parsed = JSON.parse(result);
      return NextResponse.json(normalizeAtsPayload(parsed) ?? { raw: result });
    } catch {
      return NextResponse.json({ raw: result });
    }
  } catch (error) {
    console.error("ATS analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to run ATS analysis", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
