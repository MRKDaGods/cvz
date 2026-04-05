import { CopilotClient } from "@github/copilot-sdk";

export interface ModelInfo {
  id: string;
  name: string;
}

let cachedModels: ModelInfo[] | null = null;

export async function listModels(client: CopilotClient): Promise<ModelInfo[]> {
  if (cachedModels) return cachedModels;

  const models = await client.listModels();
  cachedModels = models.map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
  }));
  return cachedModels;
}

export function clearModelCache(): void {
  cachedModels = null;
}
