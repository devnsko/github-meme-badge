import { describe, expect, it } from 'vitest';
import { makeStats } from './__fixtures__/stats';
import { TAGLINES, TITLES } from './copy';
import { buildMeme } from './meme';
import { ARCHETYPES, scoreProfile, TIERS } from './scoring';

const meme = (overrides = {}) => {
  const stats = makeStats(overrides);
  return buildMeme(stats, scoreProfile(stats));
};

const USERNAMES = ['octocat', 'defunkt', 'mojombo', 'torvalds', 'devnsko', 'gaearon', 'yyx990803'];

describe('buildMeme', () => {
  it('is deterministic for a given username', () => {
    expect(meme()).toEqual(meme());
  });

  it('ignores username casing', () => {
    expect(meme({ username: 'OctoCat' })).toEqual(meme({ username: 'octocat' }));
  });

  it('varies the copy across usernames', () => {
    const taglines = new Set(USERNAMES.map((username) => meme({ username }).tagline));
    expect(taglines.size).toBeGreaterThan(1);
  });

  it('always fills every slot, even for an empty profile', () => {
    const empty = meme({
      stars: 0,
      forks: 0,
      followers: 0,
      publicRepos: 0,
      originalRepos: 0,
      gists: 0,
      languageCount: 0,
      topLanguage: null,
      hitRate: 0,
      accountAgeDays: 3,
      daysSinceLastPush: null,
    });

    expect(empty.title.length).toBeGreaterThan(0);
    expect(empty.tagline.length).toBeGreaterThan(0);
    expect(empty.punchline.length).toBeGreaterThan(0);
  });

  it('leaves no unresolved placeholders', () => {
    for (const username of USERNAMES) {
      const copy = meme({ username });
      expect(`${copy.title} ${copy.tagline} ${copy.punchline}`).not.toMatch(/\{n\}|\{lang\}/);
    }
  });

  it('draws the title from the pool for the scored archetype and tier', () => {
    const stats = makeStats();
    const score = scoreProfile(stats);
    expect(TITLES[score.archetype][score.tier]).toContain(buildMeme(stats, score).title);
  });

  it('names a dormant account rather than praising its activity', () => {
    const copy = meme({ daysSinceLastPush: 900 });
    expect(TITLES.dormant.low.concat(TITLES.dormant.mid, TITLES.dormant.high)).toContain(copy.title);
  });

  it('mentions the top language for at least some users', () => {
    const punchlines = USERNAMES.map((username) => meme({ username, topLanguage: 'Rust' }).punchline);
    expect(punchlines.some((line) => line.includes('Rust'))).toBe(true);
  });
});

describe('copy pools', () => {
  it('covers every archetype and tier', () => {
    for (const archetype of ARCHETYPES) {
      for (const tier of TIERS) {
        expect(TITLES[archetype][tier].length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps titles short enough for the badge pill', () => {
    for (const archetype of ARCHETYPES) {
      for (const tier of TIERS) {
        for (const title of TITLES[archetype][tier]) {
          expect(title.length).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it('has no duplicate titles across the whole pool', () => {
    const all = ARCHETYPES.flatMap((archetype) => TIERS.flatMap((tier) => TITLES[archetype][tier]));
    expect(new Set(all).size).toBe(all.length);
  });

  it('offers a substantial tagline pool with no duplicates', () => {
    expect(TAGLINES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(TAGLINES).size).toBe(TAGLINES.length);
  });
});
