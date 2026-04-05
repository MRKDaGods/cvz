import { NextResponse } from "next/server";
import { getActiveAccount } from "@/lib/auth/session";
import { getCopilotClient } from "@/lib/copilot/client";
import { listModels } from "@/lib/copilot/models";

export type PipelineStage = "extract" | "optimize" | "latex" | "refine" | "smart";

interface StageDefault {
  modelId: string;
  reason: string;
}

const STAGE_REASONS: Record<PipelineStage, string> = {
  extract: "Structured parsing — free/fast model is plenty",
  optimize: "Creative rewriting needs the most capable model",
  latex: "Code generation — Codex models excel here",
  refine: "Targeted editing — capable model recommended",
  smart: "Analysis — fast free model saves quota",
};

function resolveDefaults(
  modelIds: string[],
  envDefault: string
): Record<PipelineStage, StageDefault> {
  const fallback = modelIds.includes(envDefault) ? envDefault : modelIds[0] ?? "gpt-4.1";

  // Pick best available for each stage category
  const pick = (preferred: string[]) => {
    for (const id of preferred) {
      if (modelIds.includes(id)) return id;
    }
    return fallback;
  };

  return {
    extract: {
      // Free models (0x cost) for simple structured parsing
      modelId: pick(["gpt-4.1", "gpt-4o", "gpt-5-mini", fallback]),
      reason: STAGE_REASONS.extract,
    },
    optimize: {
      // Most capable model for creative CV rewriting — quality matters most
      modelId: pick(["claude-sonnet-4.6", "claude-sonnet-4", "claude-opus-4.6", "gpt-5.1", fallback]),
      reason: STAGE_REASONS.optimize,
    },
    latex: {
      // Codex models are purpose-built for code generation
      modelId: pick(["gpt-5.1-codex", "gpt-5.2-codex", "gpt-5.3-codex", "claude-sonnet-4.6", fallback]),
      reason: STAGE_REASONS.latex,
    },
    refine: {
      // Good quality model for targeted section editing
      modelId: pick(["claude-sonnet-4.6", "claude-sonnet-4", "gpt-5.1", fallback]),
      reason: STAGE_REASONS.refine,
    },
    smart: {
      // Free/cheap models for analysis — saves quota for optimize/refine
      modelId: pick(["gpt-4.1", "gpt-4o", "gpt-5-mini", "gemini-3-flash", fallback]),
      reason: STAGE_REASONS.smart,
    },
  };
}

export async function GET() {
  const account = await getActiveAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await getCopilotClient(account.accessToken, account.id);
    const models = await listModels(client);
    const modelIds = models.map((m) => m.id);
    const envDefault = process.env.COPILOT_MODEL ?? "gpt-4.1";
    const defaults = resolveDefaults(modelIds, envDefault);

    return NextResponse.json({ models, defaults });
  } catch (error) {
    console.error("Failed to list models:", error);
    return NextResponse.json(
      { error: "Failed to list models", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
