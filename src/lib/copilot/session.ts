import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { CopilotSession } from "@github/copilot-sdk";
import { debug } from "@/lib/debug";

export type { CopilotSession };

export interface PipelineSessionOptions {
  systemPrompt: string;
  model?: string;
}

export async function createPipelineSession(
  client: CopilotClient,
  options: PipelineSessionOptions
): Promise<CopilotSession> {
  const model = options.model ?? process.env.COPILOT_MODEL ?? "gpt-4.1";

  debug.llm(`Creating session with model: ${model}`);
  debug.llm("System prompt:", options.systemPrompt.slice(0, 200) + (options.systemPrompt.length > 200 ? "..." : ""));

  const session = await client.createSession({
    model,
    streaming: true,
    systemMessage: {
      mode: "replace",
      content: options.systemPrompt,
    },
    onPermissionRequest: approveAll,
  });

  debug.llm("Session created");
  return session;
}
