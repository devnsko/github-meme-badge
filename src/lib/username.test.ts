import { describe, expect, it } from 'vitest';
import { isValidUsername, parseUsername } from './username';

describe('isValidUsername', () => {
  it.each(['octocat', 'a', 'de-vnsko', 'A1', 'a'.repeat(39)])('accepts %s', (value) => {
    expect(isValidUsername(value)).toBe(true);
  });

  it.each([
    '',
    '-leading',
    'trailing-',
    'double--hyphen',
    'has space',
    'has.dot',
    'a'.repeat(40),
    '../../etc/passwd',
    'octocat/../admin',
  ])('rejects %s', (value) => {
    expect(isValidUsername(value)).toBe(false);
  });
});

describe('parseUsername', () => {
  it('trims whitespace and an @ prefix', () => {
    expect(parseUsername('  @octocat ')).toBe('octocat');
  });

  it('extracts the login from a profile URL', () => {
    expect(parseUsername('https://github.com/octocat')).toBe('octocat');
    expect(parseUsername('github.com/octocat/')).toBe('octocat');
    expect(parseUsername('https://www.github.com/octocat?tab=repos')).toBe('octocat');
  });

  it('rejects traversal attempts rather than sanitising them', () => {
    expect(parseUsername('../../../etc/passwd')).toBeNull();
    expect(parseUsername('..%2f..%2fsecret')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseUsername('   ')).toBeNull();
  });
});
