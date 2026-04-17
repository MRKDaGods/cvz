const GITHUB_ENV_KEYS = [
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_CALLBACK_URL",
] as const;

export type GitHubEnvKey = (typeof GITHUB_ENV_KEYS)[number];

export interface GitHubOAuthConfig {
  clientId: string | null;
  clientSecret: string | null;
  callbackUrl: string | null;
  missing: GitHubEnvKey[];
}

export function getGitHubOAuthConfig(): GitHubOAuthConfig {
  const clientId = process.env.GITHUB_CLIENT_ID ?? null;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? null;
  const callbackUrl = process.env.GITHUB_CALLBACK_URL ?? null;
  const missing = GITHUB_ENV_KEYS.filter((key) => !process.env[key]);

  return {
    clientId,
    clientSecret,
    callbackUrl,
    missing,
  };
}

export function isValidSessionSecret(secret: string | undefined): boolean {
  return typeof secret === "string" && /^[0-9a-fA-F]{64}$/.test(secret);
}

export function getEnvStatus(key: string): { configured: boolean; detail: string } {
  const value = process.env[key];
  return {
    configured: Boolean(value),
    detail: value ? "Configured" : `Set ${key} in .env.local`,
  };
}
