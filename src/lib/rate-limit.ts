/**
 * Best-effort fixed-window limiter held in module memory.
 *
 * On a serverless platform each instance keeps its own counter, so the real
 * ceiling is `limit * instances`. That is fine for the job it does here — it
 * stops one client from burning the shared GitHub rate limit — and it avoids
 * making a Redis instance a hard dependency of the project.
 */
const WINDOW_MS = 60_000;
const LIMIT = 30;
const MAX_TRACKED_CLIENTS = 10_000;

const hits = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit = LIMIT): RateLimitResult {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    // Cheap eviction: the map only grows for the length of one window.
    if (hits.size > MAX_TRACKED_CLIENTS) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }

    const resetAt = now + WINDOW_MS;
    hits.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

/** Derives a client key from proxy headers, falling back to a shared bucket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'anonymous';
}
