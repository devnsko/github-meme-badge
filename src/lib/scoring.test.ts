import { describe, expect, it } from 'vitest';
import { makeStats } from './__fixtures__/stats';
import { AXES, scoreProfile } from './scoring';

describe('scoreProfile', () => {
  it('keeps every axis and the overall inside 0-100', () => {
    const extremes = [
      makeStats(),
      makeStats({ stars: 0, forks: 0, followers: 0, publicRepos: 0, originalRepos: 0, gists: 0, languageCount: 0, hitRate: 0, accountAgeDays: 0, daysSinceLastPush: null }),
      makeStats({ stars: 5_000_000, forks: 900_000, followers: 300_000, publicRepos: 5_000, gists: 3_000, languageCount: 40, hitRate: 1, accountAgeDays: 20_000, daysSinceLastPush: 0 }),
    ];

    for (const stats of extremes) {
      const score = scoreProfile(stats);
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
      for (const axis of AXES) {
        expect(score.axes[axis]).toBeGreaterThanOrEqual(0);
        expect(score.axes[axis]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('separates orders of magnitude instead of saturating', () => {
    const small = scoreProfile(makeStats({ stars: 10, followers: 5 })).axes.reach;
    const medium = scoreProfile(makeStats({ stars: 1_000, followers: 300 })).axes.reach;
    const large = scoreProfile(makeStats({ stars: 200_000, followers: 50_000 })).axes.reach;

    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
  });

  it('flags a year of silence as dormant regardless of the numbers', () => {
    const score = scoreProfile(makeStats({ stars: 90_000, daysSinceLastPush: 700 }));
    expect(score.archetype).toBe('dormant');
    expect(score.axes.activity).toBe(0);
  });

  it('flags a young, sparse account as a rookie', () => {
    expect(
      scoreProfile(makeStats({ accountAgeDays: 60, publicRepos: 2, stars: 1, followers: 0 })).archetype,
    ).toBe('rookie');
  });

  it('does not call an established account a rookie', () => {
    expect(scoreProfile(makeStats()).archetype).not.toBe('rookie');
  });

  it('picks the archetype the profile actually leans on', () => {
    const base = {
      stars: 0,
      forks: 0,
      followers: 0,
      publicRepos: 4,
      originalRepos: 4,
      gists: 0,
      languageCount: 1,
      hitRate: 0,
      accountAgeDays: 2_000,
      daysSinceLastPush: 3,
    };

    expect(scoreProfile(makeStats({ ...base, stars: 40_000, followers: 20_000 })).archetype).toBe('reach');
    expect(scoreProfile(makeStats({ ...base, forks: 8_000, hitRate: 1 })).archetype).toBe('influence');
    expect(scoreProfile(makeStats({ ...base, publicRepos: 400, gists: 200 })).archetype).toBe('output');
    expect(scoreProfile(makeStats({ ...base, languageCount: 14 })).archetype).toBe('diversity');
  });

  it('rises through the tiers as a profile grows', () => {
    const quiet = scoreProfile(
      makeStats({ stars: 0, forks: 0, followers: 1, publicRepos: 2, originalRepos: 2, gists: 0, languageCount: 1, hitRate: 0, accountAgeDays: 900, daysSinceLastPush: 200 }),
    );
    const huge = scoreProfile(
      makeStats({ stars: 300_000, forks: 90_000, followers: 200_000, publicRepos: 300, gists: 100, languageCount: 12, hitRate: 0.9, accountAgeDays: 6_000, daysSinceLastPush: 0 }),
    );

    expect(quiet.tier).toBe('low');
    expect(huge.tier).toBe('high');
    expect(huge.overall).toBeGreaterThan(quiet.overall);
  });

  it('is a pure function of the stats', () => {
    expect(scoreProfile(makeStats())).toEqual(scoreProfile(makeStats()));
  });
});
