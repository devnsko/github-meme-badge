import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isStorageConfigured, publicBaseUrl, readStoredBadge, storeBadge } from './r2';

const R2_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
] as const;

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
    expect(publicBaseUrl()).toBeNull();
  });

  it('reads as a miss rather than throwing', async () => {
    await expect(readStoredBadge('octocat', 'light')).resolves.toBeNull();
  });

  it('reports a write as not stored rather than throwing', async () => {
    await expect(storeBadge('octocat', 'light', '<svg/>')).resolves.toBe(false);
  });

  it('makes no network call and logs no warning', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await readStoredBadge('octocat', 'light');
    await storeBadge('octocat', 'light', '<svg/>');

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

  it('reports the public base URL only when one is set', () => {
    expect(publicBaseUrl()).toBeNull();
    process.env.R2_PUBLIC_BASE_URL = 'https://cdn.example.com';
    expect(publicBaseUrl()).toBe('https://cdn.example.com');
  });
});
