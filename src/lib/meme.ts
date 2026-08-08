import {
  ACTIVITY_TIERS,
  FOLLOWER_TIERS,
  FORK_TIERS,
  HIT_RATE_TIERS,
  LANGUAGE_COUNT_TIERS,
  LANGUAGE_LINES,
  REPO_TIERS,
  STAR_TIERS,
  TAGLINES,
  TENURE_TIERS,
  TITLES,
} from './copy';
import type { GitHubStats } from './github';
import type { ProfileScore } from './scoring';
import { formatCount } from './text';

/**
 * FNV-1a. The badge is embedded in READMEs and re-fetched forever, so every
 * choice has to be stable per user rather than random on each cache miss.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length];
}

interface TierRule {
  min: number;
  lines: string[];
}

/** Resolves the tier a value falls into, then a line from it. */
function tierLine(tiers: TierRule[], value: number, seed: number): string {
  const rule = tiers.find((tier) => value >= tier.min) ?? tiers[tiers.length - 1];
  return pick(rule.lines, seed).replace('{n}', formatCount(Math.round(value)));
}

export interface MemeCopy {
  /** Short rank shown in the badge pill, e.g. "Fork Overlord". */
  title: string;
  tagline: string;
  punchline: string;
}

/**
 * Builds one punchline from whichever facets the profile actually has
 * something to say about, so the line matches the numbers on the card.
 */
function punchlineCandidates(stats: GitHubStats, seed: number): string[] {
  const candidates = [
    tierLine(STAR_TIERS, stats.stars, seed),
    tierLine(FORK_TIERS, stats.forks, seed >>> 3),
    tierLine(FOLLOWER_TIERS, stats.followers, seed >>> 5),
    tierLine(REPO_TIERS, stats.publicRepos, seed >>> 7),
    tierLine(LANGUAGE_COUNT_TIERS, stats.languageCount, seed >>> 9),
    tierLine(TENURE_TIERS, Math.floor(stats.accountAgeDays / 365), seed >>> 11),
  ];

  if (stats.daysSinceLastPush !== null) {
    candidates.push(tierLine(ACTIVITY_TIERS, stats.daysSinceLastPush, seed >>> 13));
  }

  // A hit-rate line only means anything once there are repos to divide by.
  if (stats.originalRepos >= 3) {
    candidates.push(tierLine(HIT_RATE_TIERS, Math.round(stats.hitRate * 100), seed >>> 15));
  }

  if (stats.topLanguage) {
    const lines = LANGUAGE_LINES[stats.topLanguage];
    candidates.push(
      lines ? pick(lines, seed >>> 17) : `${stats.topLanguage} turns into meme gold here.`,
    );
  }

  return candidates;
}

export function buildMeme(stats: GitHubStats, score: ProfileScore): MemeCopy {
  const seed = hash(stats.username.toLowerCase());

  return {
    title: pick(TITLES[score.archetype][score.tier], seed >>> 19),
    tagline: pick(TAGLINES, seed),
    punchline: pick(punchlineCandidates(stats, seed), seed >>> 21),
  };
}
