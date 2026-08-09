import { describe, expect, it } from 'vitest';
import { badgeKey, publicBadgeUrl } from './key';

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
