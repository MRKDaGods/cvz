import { NextRequest, NextResponse } from "next/server";
import { getActiveAccount, verifySessionOwner } from "@/lib/auth/session";
import { getCopilotClient } from "@/lib/copilot/client";
import { createPipelineSession } from "@/lib/copilot/session";
import { createSSEFromSession } from "@/lib/stream/sse";
import { db } from "@/lib/db";
import { debug } from "@/lib/debug";
import { decrypt } from "@/lib/auth/crypto";
import { fetchGitHubContext } from "@/lib/github/fetch-repos";
import { parseSectionContent, serializeSectionContent, extractJSON } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const account = await getActiveAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, model, userNotes } = await request.json();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    if (!(await verifySessionOwner(sessionId))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    debug.pipeline(`[optimize] Starting for session ${sessionId}`);

    const dbSession = await db.session.findUnique({
      where: { id: sessionId },
      include: { sections: { orderBy: { order: "asc" } } },
    });
    if (!dbSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // First extract keywords if not done
    if (!dbSession.keywords) {
      debug.pipeline("[optimize] Keywords missing, extracting first...");
      const keywordsRes = await fetch(
        new URL("/api/pipeline/keywords", request.url),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") ?? "",
          },
          body: JSON.stringify({ sessionId }),
        }
      );
      await keywordsRes.json();
    }

    // Re-fetch session with keywords
    const updatedSession = await db.session.findUnique({
      where: { id: sessionId },
      include: { sections: { orderBy: { order: "asc" } } },
    });

    const { optimizeAndScoreCvPrompt } = await import("@/lib/pipeline/prompts");

    // Fetch GitHub repo context if user notes contain GitHub links
    let enrichedNotes = typeof userNotes === "string" ? userNotes.trim() : "";
    if (enrichedNotes) {
      try {
        const githubToken = decrypt(account.accessToken);
        const githubContext = await fetchGitHubContext(enrichedNotes, githubToken);
        if (githubContext) {
          enrichedNotes = enrichedNotes + "\n" + githubContext;
          debug.pipeline(`[optimize] Enriched notes with GitHub context (${githubContext.length} chars)`);
        }
      } catch (err) {
        debug.pipeline("[optimize] GitHub context fetch failed (non-fatal):", err instanceof Error ? err.message : String(err));
      }
    }

    const sectionsJson = JSON.stringify(
      updatedSession!.sections.map((s) => {
        const payload = parseSectionContent(s.originalContent);
        return {
          type: s.type,
          title: s.title,
          content: payload.content,
          entries: payload.entries,
        };
      })
    );

    debug.pipeline(`[optimize] ${updatedSession!.sections.length} sections to optimize`);

    const client = await getCopilotClient(account.accessToken, account.id);
    const prompt = optimizeAndScoreCvPrompt(
      sectionsJson,
      updatedSession!.keywords ?? "{}",
      updatedSession!.fieldAnalysis ?? "{}",
      enrichedNotes || undefined,
    );
    const session = await createPipelineSession(client, { systemPrompt: prompt, model });
    debug.pipeline("[optimize] Session created, starting optimization stream...");

    return createSSEFromSession(
      session,
      "Optimize this CV with maximum impact. Generate aiComments for each section.",
      {
        onComplete: async (fullText) => {
          try {
            debug.pipeline(`[optimize] Parsing LLM response (${fullText.length} chars)...`);
            const result = extractJSON(fullText);
            const resultSections = (Array.isArray(result.sections) ? result.sections : []) as Record<string, unknown>[];

            // Update sections with optimized content and AI comments
            // Match by type since LLM may reorder sections
            if (resultSections.length > 0) {
              const dbSections = updatedSession!.sections;
              const dbSectionsByType = new Map<string, (typeof dbSections)[number]>();
              for (const s of dbSections) {
                if (!dbSectionsByType.has(s.type)) {
                  dbSectionsByType.set(s.type, s);
                }
              }

              for (let i = 0; i < resultSections.length; i++) {
                const s = resultSections[i] as Record<string, unknown>;
                const existing = dbSectionsByType.get(s.type as string);
                if (existing) {
                  await db.cvSection.update({
                    where: { id: existing.id },
                    data: {
                      optimizedContent: serializeSectionContent(
                        s.content,
                        Array.isArray(s.entries) ? s.entries : undefined,
                      ),
                      aiComments: s.aiComments ? JSON.stringify(s.aiComments) : null,
                    },
                  });
                }
              }
            }

            // Save scores
            if (result.scores) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const scoreData = result.scores as any;
              await db.score.upsert({
                where: { sessionId },
                create: scoreData,
                update: scoreData,
              });
            }

            await db.session.update({
              where: { id: sessionId },
              data: { stage: "optimize" },
            });
          } catch (err) {
            debug.error("[optimize] Failed to parse LLM response:", err instanceof Error ? err.message : String(err));
          }
        },
      }
    );
  } catch (error) {
    console.error("CV optimization failed:", error);
    return NextResponse.json(
      { error: "Failed to optimize CV", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
