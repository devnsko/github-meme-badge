import { describe, expect, it } from 'vitest';
import { badgeKey, checkPublicBaseUrl, publicBadgeUrl } from './key';

describe('badgeKey', () => {
  it('namespaces by username and theme', () => {
    expect(badgeKey('octocat', 'light')).toBe('badges/octocat/light.svg');
    expect(badgeKey('octocat', 'dark')).toBe('badges/octocat/dark.svg');
  });

  it('lowercases so a case-different login is the same object', () => {
    expect(badgeKey('OctoCat', 'light')).toBe(badgeKey('octocat', 'light'));
  });

  it('refuses to build a key that could escape the prefix', () => {
    // An object key is a path; unvalidated input here writes outside the prefix.
    expect(() => badgeKey('../../secret', 'light')).toThrow();
    expect(() => badgeKey('a/b', 'light')).toThrow();
    expect(() => badgeKey('', 'light')).toThrow();
  });
});

describe('publicBadgeUrl', () => {
  it('joins the bucket base with the object key', () => {
    expect(publicBadgeUrl('https://cdn.example.com', 'octocat', 'light')).toBe(
      'https://cdn.example.com/badges/octocat/light.svg',
    );
  });

  it('tolerates a trailing slash on the base', () => {
    expect(publicBadgeUrl('https://cdn.example.com/', 'octocat', 'dark')).toBe(
      'https://cdn.example.com/badges/octocat/dark.svg',
    );
  });

  it('inherits the key validation', () => {
    expect(() => publicBadgeUrl('https://cdn.example.com', '../evil', 'light')).toThrow();
  });
});

describe('checkPublicBaseUrl', () => {
  it('accepts an r2.dev subdomain and a custom domain', () => {
    expect(checkPublicBaseUrl('https://pub-abc123.r2.dev')).toEqual({
      url: 'https://pub-abc123.r2.dev',
      problem: null,
    });
    expect(checkPublicBaseUrl('https://badges.example.com/').url).toBe(
      'https://badges.example.com',
    );
  });

  it('rejects the S3 API endpoint, which never serves anonymously', () => {
    // The exact misconfiguration that put bare link text in a README: objects
    // do live at this host, but every GET there needs a SigV4 signature, so
    // GitHub's image proxy receives an XML error instead of an image.
    const result = checkPublicBaseUrl(
      'https://fce201e1cf4a02ff44a934d35b114014.r2.cloudflarestorage.com/github-badges',
    );

    expect(result.url).toBeNull();
    expect(result.problem).toMatch(/r2\.dev|custom domain/);
  });

  it('rejects a malformed or non-http URL', () => {
    expect(checkPublicBaseUrl('not a url').url).toBeNull();
    expect(checkPublicBaseUrl('ftp://example.com').url).toBeNull();
    expect(checkPublicBaseUrl('not a url').problem).toBeTruthy();
  });

  it('treats an unset value as simply off, not as a problem', () => {
    expect(checkPublicBaseUrl(null)).toEqual({ url: null, problem: null });
    expect(checkPublicBaseUrl('')).toEqual({ url: null, problem: null });
  });
});
