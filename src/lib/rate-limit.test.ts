import { describe, expect, it } from 'vitest';
import { clientKey, rateLimit } from './rate-limit';

describe('rateLimit', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    const key = `test-${Math.random()}`;

    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3).allowed).toBe(true);
    }

    expect(rateLimit(key, 3).allowed).toBe(false);
  });

  it('counts each client separately', () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;

    rateLimit(a, 1);
    expect(rateLimit(a, 1).allowed).toBe(false);
    expect(rateLimit(b, 1).allowed).toBe(true);
  });

  it('reports the remaining budget and a reset time in the future', () => {
    const result = rateLimit(`r-${Math.random()}`, 5);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});

describe('clientKey', () => {
  const request = (headers: Record<string, string>) => new Request('https://x.test', { headers });

  it('uses the first hop of x-forwarded-for', () => {
    expect(clientKey(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip, then to a shared bucket', () => {
    expect(clientKey(request({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientKey(request({}))).toBe('anonymous');
  });
});
