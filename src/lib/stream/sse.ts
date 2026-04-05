import type { CopilotSession } from "@github/copilot-sdk";
import { debug } from "@/lib/debug";
import { stripCodeFences } from "@/lib/utils";

export interface SSEEvent {
  event: string;
  data: unknown;
}

/**
 * Bridge Copilot SDK streaming events → SSE Response for the browser.
 * Sends the prompt and streams assistant.message_delta events.
 * Collects the full response and sends it as a final "complete" event.
 */
export function createSSEFromSession(
  session: CopilotSession,
  prompt: string,
  options?: { onComplete?: (fullText: string) => void | Promise<void> }
): Response {
  const encoder = new TextEncoder();
  let fullText = "";
  let deltaCount = 0;
  let reasoningStarted = false;
  // Collect usage data during the stream — we include it in the complete event
  // since assistant.usage may fire before session.idle and the controller could
  // close before the client processes it as a separate SSE event.
  let collectedUsage: Record<string, unknown> | null = null;

  debug.sse("Creating SSE stream");
  debug.sse("Prompt:", prompt);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Controller may be closed
        }
      };

      session.on("assistant.message_delta", (e) => {
        const delta = e.data.deltaContent;
        if (delta) {
          fullText += delta;
          deltaCount++;
          if (deltaCount === 1) debug.sse("First delta received, streaming...");
          send("delta", { content: delta });
        }
      });

      // Forward reasoning/thinking deltas to the client
      session.on("assistant.reasoning_delta", (e) => {
        const delta = e.data.deltaContent;
        if (delta) {
          if (!reasoningStarted) {
            reasoningStarted = true;
            debug.sse("Reasoning started (model is thinking)...");
          }
          send("thinking", { content: delta });
        }
      });

      session.on("assistant.reasoning", (e) => {
        debug.sse(`Reasoning complete (${e.data.content.length} chars)`);
      });

      // Collect assistant.usage — send immediately AND save for inclusion in complete event
      session.on("assistant.usage", (e) => {
        const d = e.data;
        debug.sse(`Usage: model=${d.model} in=${d.inputTokens ?? 0} out=${d.outputTokens ?? 0} cost=${d.cost ?? 0} dur=${d.duration ?? 0}ms`);
        collectedUsage = {
          model: d.model,
          inputTokens: d.inputTokens ?? 0,
          outputTokens: d.outputTokens ?? 0,
          cacheReadTokens: d.cacheReadTokens ?? 0,
          cacheWriteTokens: d.cacheWriteTokens ?? 0,
          cost: d.cost ?? 0,
          durationMs: d.duration ?? 0,
          quota: extractQuotaSnapshot(d.quotaSnapshots),
          copilotUsage: d.copilotUsage ?? null,
        };
        // Also send as a separate event in case the client receives it
        send("usage", collectedUsage);
      });

      // Fallback: if streaming wasn't used, the final message has full content
      session.on("assistant.message", (e) => {
        const content = e.data.content;
        if (content && deltaCount === 0) {
          debug.sse(`Got assistant.message (no deltas), ${content.length} chars`);
          fullText = content;
          send("delta", { content });
        }
      });

      session.on("session.idle", async () => {
        debug.sse(`Stream complete — ${deltaCount} deltas, ${fullText.length} chars total`);
        if (debug.enabled()) {
          debug.sse("Response preview:", fullText.slice(0, 300));
        }
        try {
          await options?.onComplete?.(fullText);
          debug.sse("onComplete handler finished");
        } catch (err) {
          debug.error("onComplete failed:", err instanceof Error ? err.message : String(err));
        }
        // Include usage in the complete event so the client always gets it
        send("complete", { content: fullText, usage: collectedUsage });
        try {
          controller.close();
        } catch {
          // Already closed
        }
        try {
          await session.destroy();
          debug.sse("Session destroyed");
        } catch {
          // Best-effort cleanup
        }
      });

      session.on("session.error", (e) => {
        debug.error("Session error:", String(e.data));
        send("error", { message: String(e.data) });
        try {
          controller.close();
        } catch {
          // Already closed
        }
        session.destroy().catch(() => undefined);
      });

      try {
        debug.sse("Sending prompt to LLM...");
        await session.send({ prompt });
        debug.sse("Prompt sent, waiting for response...");
      } catch (err) {
        debug.error("Failed to send prompt:", err instanceof Error ? err.message : String(err));
        send("error", { message: err instanceof Error ? err.message : "Failed to send prompt" });
        try {
          controller.close();
        } catch {
          // Already closed
        }
        session.destroy().catch(() => undefined);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Send a prompt and wait for a complete response (no streaming).
 */
export async function sendAndWait(
  session: CopilotSession,
  prompt: string,
  timeout = 120_000
): Promise<string> {
  debug.sse("sendAndWait — sending prompt...");
  debug.sse("Prompt:", prompt);
  try {
    const response = await session.sendAndWait({ prompt }, timeout);
    const raw = response?.data.content ?? "";
    const content = stripCodeFences(raw);
    debug.sse(`sendAndWait — response received (${content.length} chars)`);
    return content;
  } finally {
    session.destroy().catch(() => undefined);
    debug.sse("Session destroyed");
  }
}

/** Extract the first quota snapshot from assistant.usage quotaSnapshots */
function extractQuotaSnapshot(
  snapshots?: Record<string, {
    isUnlimitedEntitlement: boolean;
    entitlementRequests: number;
    usedRequests: number;
    remainingPercentage: number;
    resetDate?: string;
    overage: number;
    overageAllowedWithExhaustedQuota: boolean;
    usageAllowedWithExhaustedQuota: boolean;
  }>
) {
  if (!snapshots) return null;
  const first = Object.values(snapshots)[0];
  if (!first) return null;
  return {
    isUnlimitedEntitlement: first.isUnlimitedEntitlement,
    entitlementRequests: first.entitlementRequests,
    usedRequests: first.usedRequests,
    remainingPercentage: first.remainingPercentage,
    resetDate: first.resetDate ?? null,
    overage: first.overage,
  };
}
