import { NextRequest, NextResponse } from "next/server";
import { getActiveAccount, verifySessionOwner } from "@/lib/auth/session";
import { getCopilotClient } from "@/lib/copilot/client";
import { createPipelineSession } from "@/lib/copilot/session";
import { createSSEFromSession } from "@/lib/stream/sse";
import { db } from "@/lib/db";
import { debug } from "@/lib/debug";
import { normalizeSectionTitle, serializeSectionContent, extractJSON } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const account = await getActiveAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, cvText, jobDesc, model } = await request.json();
  if (!sessionId || !cvText) {
    return NextResponse.json({ error: "Missing sessionId or cvText" }, { status: 400 });
  }

  if (!(await verifySessionOwner(sessionId))) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    debug.pipeline(`[extract] Starting for session ${sessionId}`);
    debug.pipeline(`[extract] CV text length: ${cvText.length}, has JD: ${!!jobDesc}`);

    const { extractSectionsPrompt } = await import("@/lib/pipeline/prompts");
    debug.pipeline("[extract] Prompt loaded, getting copilot client...");

    const client = await getCopilotClient(account.accessToken, account.id);
    debug.pipeline("[extract] Client ready, creating session...");

    const session = await createPipelineSession(client, { systemPrompt: extractSectionsPrompt(), model });
    debug.pipeline("[extract] Session created, starting SSE stream...");

    return createSSEFromSession(session, cvText, {
      onComplete: async (fullText) => {
        try {
          debug.pipeline(`[extract] Parsing LLM response (${fullText.length} chars)...`);
          const result = extractJSON(fullText);
          const sections = (Array.isArray(result.sections) ? result.sections : []) as Record<string, unknown>[];
          debug.pipeline(`[extract] Parsed OK — ${sections.length} sections`);
          // Save sections to database
          if (sections.length > 0) {
            // Delete existing sections
            await db.cvSection.deleteMany({ where: { sessionId } });

            // Create new sections
            for (let i = 0; i < sections.length; i++) {
              const s = sections[i] as Record<string, unknown>;
              debug.pipeline(`[extract] Saving section ${i}: type=${s.type}, title=${s.title}`);
              await db.cvSection.create({
                data: {
                  sessionId,
                  type: String(s.type ?? "other"),
                  title: normalizeSectionTitle(s.title, s.type),
                  originalContent: serializeSectionContent(
                    s.content ?? s.fields ?? "",
                    Array.isArray(s.entries) ? s.entries : undefined,
                  ),
                  order: i,
                },
              });
            }
          }

          // Save field analysis and update stage
          await db.session.update({
            where: { id: sessionId },
            data: {
              rawCvText: cvText,
              jobDesc,
              fieldAnalysis: result.fieldAnalysis ? JSON.stringify(result.fieldAnalysis) : null,
              stage: "review",
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          debug.error("[extract] Failed to parse LLM response:", msg);
          if (err instanceof Error && err.stack) {
            debug.error("[extract] Stack:", err.stack.slice(0, 500));
          }
        }
      },
    });
  } catch (error) {
    console.error("Extract pipeline error:", error);
    return NextResponse.json(
      { error: "Failed to extract sections", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
