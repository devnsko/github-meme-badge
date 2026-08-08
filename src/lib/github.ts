import { isValidUsername } from './username';

/** Repos are read one page at a time; GitHub caps `per_page` at 100. */
const REPO_PAGE_SIZE = 100;
const MAX_REPO_PAGES = 3;
const GITHUB_API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface GitHubStats {
  username: string;
  displayName: string;
  avatarDataUri: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  gists: number;
  /** Stars and forks are summed over original repos only — a fork's stars
   *  belong to whoever wrote it. */
  stars: number;
  forks: number;
  topLanguage: string | null;
  /** Distinct languages across original repos. */
  languageCount: number;
  originalRepos: number;
  forkedRepos: number;
  /** Repos carrying at least one star, as a share of original repos (0-1). */
  hitRate: number;
  accountAgeDays: number;
  daysSinceLastPush: number | null;
  /** True when the account has more repos than we sampled. */
  truncated: boolean;
}

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubRepo {
  fork: boolean;
  archived: boolean;
  stargazers_count: number | null;
  forks_count: number | null;
  language: string | null;
  pushed_at: string | null;
}

function headers(): HeadersInit {
  const value: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'github-meme-badge',
  };

  // Optional, but lifts the rate limit from 60 to 5000 requests per hour.
  const token = process.env.GITHUB_TOKEN;
  if (token) value.Authorization = `Bearer ${token}`;

  return value;
}

async function githubFetch(pathname: string, signal?: AbortSignal) {
  const res = await fetch(`${GITHUB_API}${pathname}`, {
    headers: headers(),
    signal,
    // We do our own caching at the response layer; skip Next's data cache so a
    // badge never gets pinned to a stale build-time snapshot.
    cache: 'no-store',
  });

  if (res.status === 404) {
    throw new GitHubError('User not found', 404);
  }

  if (res.status === 403 || res.status === 429) {
    throw new GitHubError('GitHub rate limit reached, try again later', 429);
  }

  if (!res.ok) {
    throw new GitHubError(`GitHub API error (${res.status})`, 502);
  }

  return res;
}

/**
 * Downloads the avatar and inlines it as a data URI. SVGs rendered inside a
 * README are proxied by GitHub's camo service, which will not resolve external
 * `<image href>` targets, so the bytes have to travel with the badge.
 */
async function fetchAvatar(url: string | null, signal?: AbortSignal): Promise<string | null> {
  if (!url) return null;

  try {
    const sized = new URL(url);
    sized.searchParams.set('s', '160');

    const res = await fetch(sized, { signal, cache: 'no-store' });
    if (!res.ok) return null;

    const type = res.headers.get('content-type') ?? 'image/png';
    if (!type.startsWith('image/')) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    // Guard against an unexpectedly large avatar bloating every response.
    if (bytes.byteLength > 200_000) return null;

    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

async function fetchRepos(
  username: string,
  signal?: AbortSignal,
): Promise<{ repos: GitHubRepo[]; truncated: boolean }> {
  const repos: GitHubRepo[] = [];

  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const res = await githubFetch(
      `/users/${username}/repos?per_page=${REPO_PAGE_SIZE}&page=${page}&sort=pushed`,
      signal,
    );
    const batch: GitHubRepo[] = await res.json();
    repos.push(...batch);

    if (batch.length < REPO_PAGE_SIZE) {
      return { repos, truncated: false };
    }
  }

  return { repos, truncated: true };
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export async function fetchStats(username: string, signal?: AbortSignal): Promise<GitHubStats> {
  if (!isValidUsername(username)) {
    throw new GitHubError('Invalid GitHub username', 400);
  }

  const userRes = await githubFetch(`/users/${username}`, signal);
  const user: GitHubUser = await userRes.json();

  const [{ repos, truncated }, avatarDataUri] = await Promise.all([
    fetchRepos(user.login, signal),
    fetchAvatar(user.avatar_url, signal),
  ]);

  const now = new Date();
  const originals = repos.filter((repo) => !repo.fork);

  let stars = 0;
  let forks = 0;
  let starred = 0;
  let lastPush: number | null = null;
  const languages = new Map<string, number>();

  for (const repo of originals) {
    const repoStars = repo.stargazers_count ?? 0;
    stars += repoStars;
    forks += repo.forks_count ?? 0;
    if (repoStars > 0) starred += 1;
    if (repo.language) {
      languages.set(repo.language, (languages.get(repo.language) ?? 0) + 1);
    }
  }

  // Activity looks at every repo: pushing to a fork is still pushing.
  for (const repo of repos) {
    if (!repo.pushed_at) continue;
    const pushed = Date.parse(repo.pushed_at);
    if (!Number.isNaN(pushed) && (lastPush === null || pushed > lastPush)) lastPush = pushed;
  }

  let topLanguage: string | null = null;
  let topCount = 0;
  for (const [language, count] of languages) {
    if (count > topCount) {
      topLanguage = language;
      topCount = count;
    }
  }

  const createdAt = Date.parse(user.created_at);

  return {
    username: user.login,
    displayName: user.name?.trim() || user.login,
    avatarDataUri,
    publicRepos: user.public_repos ?? repos.length,
    followers: user.followers ?? 0,
    following: user.following ?? 0,
    gists: user.public_gists ?? 0,
    stars,
    forks,
    topLanguage,
    languageCount: languages.size,
    originalRepos: originals.length,
    forkedRepos: repos.length - originals.length,
    hitRate: originals.length ? starred / originals.length : 0,
    accountAgeDays: Number.isNaN(createdAt) ? 0 : daysBetween(new Date(createdAt), now),
    daysSinceLastPush: lastPush === null ? null : daysBetween(new Date(lastPush), now),
    truncated,
  };
}
