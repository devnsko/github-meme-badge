import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { badgeKey, isStorageConfigured, readStoredBadge, storeBadge } from './r2';

const R2_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
] as const;

describe('badgeKey', () => {
  it('namespaces by username and theme', () => {
    expect(badgeKey('octocat', 'dark')).toBe('badges/octocat/dark.svg');
    expect(badgeKey('octocat', 'light')).toBe('badges/octocat/light.svg');
  });

  it('lowercases so a case-different login is the same object', () => {
    expect(badgeKey('OctoCat', 'dark')).toBe(badgeKey('octocat', 'dark'));
  });

  it('refuses to build a key that could escape the prefix', () => {
    // An object key is a path; unvalidated input here writes outside the prefix.
    expect(() => badgeKey('../../secret', 'dark')).toThrow();
    expect(() => badgeKey('a/b', 'dark')).toThrow();
    expect(() => badgeKey('', 'dark')).toThrow();
  });
});

describe('storage without R2 configured', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of R2_VARS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const key of R2_VARS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.restoreAllMocks();
  });

  it('reports itself as unconfigured', () => {
    expect(isStorageConfigured()).toBe(false);
  });

  it('reads as a miss rather than throwing', async () => {
    await expect(readStoredBadge('octocat', 'dark')).resolves.toBeNull();
  });

  it('accepts writes as a no-op', async () => {
    await expect(storeBadge('octocat', 'dark', '<svg/>')).resolves.toBeUndefined();
  });

  it('makes no network call and logs nothing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await readStoredBadge('octocat', 'dark');
    await storeBadge('octocat', 'dark', '<svg/>');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('needs every credential, not just some', () => {
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'key';
    expect(isStorageConfigured()).toBe(false);

    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    expect(isStorageConfigured()).toBe(false);

    process.env.R2_BUCKET = 'badges';
    expect(isStorageConfigured()).toBe(true);
  });
});
