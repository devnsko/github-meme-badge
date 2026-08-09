/**
 * Structured trace for the badge pipeline.
 *
 * On in development, so `npm run dev` shows every read, write and cache
 * decision as it happens. `BADGE_DEBUG=1` turns it on anywhere else — the
 * fields are deliberately non-secret (keys, sizes, timings, status codes) so
 * enabling it in production leaks nothing.
 */
export const debugEnabled =
  process.env.NODE_ENV !== 'production' || process.env.BADGE_DEBUG === '1';

type Field = string | number | boolean | null | undefined;

export function debugLog(event: string, fields: Record<string, Field> = {}): void {
  if (!debugEnabled) return;

  const rendered = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');

  console.info(`[badge] ${event}${rendered ? ` ${rendered}` : ''}`);
}

/** Returns elapsed milliseconds since the call. */
export function startTimer(): () => number {
  const started = Date.now();
  return () => Date.now() - started;
}
