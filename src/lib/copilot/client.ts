import { CopilotClient } from "@github/copilot-sdk";
import { decrypt } from "@/lib/auth/crypto";
import { debug } from "@/lib/debug";

// Cache clients per account to avoid re-creating CLI processes
const clientCache = new Map<string, CopilotClient>();

export async function getCopilotClient(
  encryptedToken: string,
  accountId: string
): Promise<CopilotClient> {
  const existing = clientCache.get(accountId);
  if (existing) {
    debug.copilot(`Reusing cached client for account ${accountId}`);
    return existing;
  }

  debug.copilot(`Creating new CopilotClient for account ${accountId}`);
  const githubToken = decrypt(encryptedToken);
  debug.copilot("Token decrypted successfully");

  const client = new CopilotClient({
    githubToken,
    useLoggedInUser: false,
  });

  debug.copilot("Starting CLI subprocess...");
  await client.start();
  debug.copilot("CLI subprocess started");

  clientCache.set(accountId, client);
  return client;
}

export async function stopCopilotClient(accountId: string): Promise<void> {
  const client = clientCache.get(accountId);
  if (client) {
    await client.stop();
    clientCache.delete(accountId);
  }
}

export async function stopAllClients(): Promise<void> {
  for (const [id, client] of clientCache) {
    await client.stop();
    clientCache.delete(id);
  }
}
