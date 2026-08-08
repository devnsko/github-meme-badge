import type { GitHubStats } from './github';

/**
 * A profile is scored on seven axes, each normalised to 0-100. The archetype is
 * the axis a profile leans on hardest, which is what the title is drawn from —
 * so someone with three famous repos reads differently from someone with two
 * hundred quiet ones, even at a similar overall level.
 */
export const AXES = [
  'reach',
  'influence',
  'output',
  'craft',
  'diversity',
  'activity',
  'tenure',
] as const;
export type Axis = (typeof AXES)[number];

/** `rookie` and `dormant` are states, not strengths: they override the axes. */
export const ARCHETYPES = [...AXES, 'rookie', 'dormant'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const TIERS = ['low', 'mid', 'high'] as const;
export type Tier = (typeof TIERS)[number];

export interface ProfileScore {
  axes: Record<Axis, number>;
  /** Weighted blend of every axis, 0-100. */
  overall: number;
  archetype: Archetype;
  tier: Tier;
}

/**
 * Logarithmic normalisation. GitHub counts span six orders of magnitude, so a
 * linear scale would put everyone below 1 and leave the top two accounts alone
 * at the ceiling.
 */
function norm(value: number, ceiling: number): number {
  if (value <= 0) return 0;
  const scaled = Math.log10(1 + value) / Math.log10(1 + ceiling);
  return Math.max(0, Math.min(100, Math.round(scaled * 100)));
}

/** Linear normalisation for values that already live on a small bounded scale. */
function linear(value: number, ceiling: number): number {
  return Math.max(0, Math.min(100, Math.round((value / ceiling) * 100)));
}

const CEILINGS = {
  stars: 5_000,
  forks: 1_000,
  followers: 3_000,
  repos: 150,
  gists: 60,
  languages: 10,
  avgStars: 250,
  tenureDays: 4_015, // ~11 years
} as const;

/** How much each axis contributes to the overall level. */
const WEIGHTS: Record<Axis, number> = {
  reach: 1.35,
  influence: 1.15,
  output: 0.9,
  craft: 1,
  diversity: 0.7,
  activity: 0.85,
  tenure: 0.6,
};

const DORMANT_AFTER_DAYS = 365;
const ROOKIE_MAX_AGE_DAYS = 400;
const ROOKIE_MAX_REPOS = 6;

export function scoreProfile(stats: GitHubStats): ProfileScore {
  const sampled = stats.originalRepos || 1;
  const avgStars = stats.stars / sampled;
  const days = stats.daysSinceLastPush;

  // Freshness decays over a year: pushed today = 100, a year silent = 0.
  const freshness = days === null ? 0 : Math.max(0, 100 - (days / DORMANT_AFTER_DAYS) * 100);

  const axes: Record<Axis, number> = {
    reach: Math.round(norm(stats.stars, CEILINGS.stars) * 0.6 + norm(stats.followers, CEILINGS.followers) * 0.4),
    influence: Math.round(
      norm(stats.forks, CEILINGS.forks) * 0.75 + linear(stats.hitRate * 100, 100) * 0.25,
    ),
    output: Math.round(
      norm(stats.publicRepos, CEILINGS.repos) * 0.75 + norm(stats.gists, CEILINGS.gists) * 0.25,
    ),
    craft: Math.round(norm(avgStars, CEILINGS.avgStars) * 0.7 + linear(stats.hitRate * 100, 100) * 0.3),
    diversity: norm(stats.languageCount, CEILINGS.languages),
    activity: Math.round(freshness),
    tenure: norm(stats.accountAgeDays, CEILINGS.tenureDays),
  };

  const totalWeight = Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const overall = Math.round(
    AXES.reduce((sum, axis) => sum + axes[axis] * WEIGHTS[axis], 0) / totalWeight,
  );

  return { axes, overall, archetype: pickArchetype(stats, axes), tier: pickTier(overall) };
}

function pickArchetype(stats: GitHubStats, axes: Record<Axis, number>): Archetype {
  if (stats.daysSinceLastPush !== null && stats.daysSinceLastPush > DORMANT_AFTER_DAYS) {
    return 'dormant';
  }

  if (stats.accountAgeDays < ROOKIE_MAX_AGE_DAYS && stats.publicRepos <= ROOKIE_MAX_REPOS) {
    return 'rookie';
  }

  // Tenure and activity are weak signals on their own — almost everyone scores
  // on them — so they only win when nothing else stands out.
  const priority: Axis[] = ['reach', 'influence', 'craft', 'output', 'diversity', 'activity', 'tenure'];

  let best: Axis = 'output';
  let bestValue = -1;
  for (const axis of priority) {
    const value = axis === 'tenure' || axis === 'activity' ? axes[axis] * 0.75 : axes[axis];
    if (value > bestValue) {
      best = axis;
      bestValue = value;
    }
  }

  return best;
}

function pickTier(overall: number): Tier {
  if (overall < 28) return 'low';
  if (overall < 58) return 'mid';
  return 'high';
}
