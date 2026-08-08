import type { GitHubStats } from '../github';

/** A mid-sized, currently active profile. Override whatever a test cares about. */
export const makeStats = (overrides: Partial<GitHubStats> = {}): GitHubStats => ({
  username: 'octocat',
  displayName: 'The Octocat',
  avatarDataUri: null,
  publicRepos: 8,
  followers: 12_034,
  following: 9,
  gists: 4,
  stars: 421,
  forks: 37,
  topLanguage: 'TypeScript',
  languageCount: 3,
  originalRepos: 6,
  forkedRepos: 2,
  hitRate: 0.5,
  accountAgeDays: 2_500,
  daysSinceLastPush: 4,
  truncated: false,
  ...overrides,
});
