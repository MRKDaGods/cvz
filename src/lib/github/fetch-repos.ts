import { debug } from "@/lib/debug";

const GITHUB_API = "https://api.github.com";
const README_MAX_CHARS = 2000;
const MAX_REPOS = 5;

interface RepoInfo {
  owner: string;
  repo: string;
  description: string | null;
  language: string | null;
  languages: Record<string, number>;
  stars: number;
  forks: number;
  topics: string[];
  readme: string | null;
}

/**
 * Extract GitHub owner/repo pairs from text.
 * Matches: github.com/owner/repo, https://github.com/owner/repo, owner/repo (if looks valid)
 */
export function extractGitHubLinks(text: string): { owner: string; repo: string }[] {
  const pattern = /(?:https?:\/\/)?github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/gi;
  const seen = new Set<string>();
  const results: { owner: string; repo: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const owner = match[1];
    // Strip trailing .git or fragments
    const repo = match[2].replace(/\.git$/, "").replace(/#.*$/, "");
    const key = `${owner}/${repo}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ owner, repo });
    }
  }

  return results.slice(0, MAX_REPOS);
}

async function githubGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "cvz-optimizer",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchReadme(owner: string, repo: string, token: string): Promise<string | null> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3.raw",
      "User-Agent": "cvz-optimizer",
    },
  });
  if (!res.ok) return null;
  const text = await res.text();
  // Truncate to keep prompt size reasonable
  return text.length > README_MAX_CHARS
    ? text.slice(0, README_MAX_CHARS) + "\n...(truncated)"
    : text;
}

/**
 * Fetch full repo info for a single GitHub repo.
 */
async function fetchRepoInfo(owner: string, repo: string, token: string): Promise<RepoInfo | null> {
  try {
    const [repoData, languages, readme] = await Promise.all([
      githubGet(`/repos/${owner}/${repo}`, token) as Promise<Record<string, unknown> | null>,
      githubGet(`/repos/${owner}/${repo}/languages`, token) as Promise<Record<string, number> | null>,
      fetchReadme(owner, repo, token),
    ]);

    if (!repoData) return null;

    return {
      owner,
      repo,
      description: (repoData.description as string) ?? null,
      language: (repoData.language as string) ?? null,
      languages: languages ?? {},
      stars: (repoData.stargazers_count as number) ?? 0,
      forks: (repoData.forks_count as number) ?? 0,
      topics: Array.isArray(repoData.topics) ? repoData.topics as string[] : [],
      readme,
    };
  } catch (err) {
    debug.pipeline(`[github] Failed to fetch ${owner}/${repo}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Given text (user notes), extract GitHub links and fetch repo info for each.
 * Returns a formatted context string to inject into the prompt, or empty string if no links found.
 */
export async function fetchGitHubContext(text: string, token: string): Promise<string> {
  const links = extractGitHubLinks(text);
  if (links.length === 0) return "";

  debug.pipeline(`[github] Found ${links.length} GitHub link(s), fetching...`);

  const repos = await Promise.all(
    links.map(({ owner, repo }) => fetchRepoInfo(owner, repo, token))
  );

  const validRepos = repos.filter((r): r is RepoInfo => r !== null);
  if (validRepos.length === 0) return "";

  const blocks = validRepos.map((r) => {
    const lines = [`### ${r.owner}/${r.repo}`];
    if (r.description) lines.push(`Description: ${r.description}`);
    if (r.language) lines.push(`Primary language: ${r.language}`);
    if (Object.keys(r.languages).length > 0) {
      lines.push(`Languages: ${Object.keys(r.languages).join(", ")}`);
    }
    if (r.stars > 0) lines.push(`Stars: ${r.stars}`);
    if (r.topics.length > 0) lines.push(`Topics: ${r.topics.join(", ")}`);
    if (r.readme) {
      lines.push("", "README:", r.readme);
    }
    return lines.join("\n");
  });

  debug.pipeline(`[github] Fetched ${validRepos.length} repo(s) successfully`);

  return `\n=== GITHUB REPOSITORY CONTEXT ===
The following repositories were referenced by the candidate. Use this real data to write accurate, specific project descriptions and skill claims.

${blocks.join("\n\n---\n\n")}
`;
}
