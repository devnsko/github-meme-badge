import { createHash } from 'crypto';
import { after } from 'next/server';
import { isTheme, renderBadge, renderErrorBadge, type Theme } from '@/lib/badge';
import { fetchStats, GitHubError } from '@/lib/github';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { scoreProfile } from '@/lib/scoring';
import { readStoredBadge, storeBadge } from '@/lib/storage/r2';
import { parseUsername } from '@/lib/username';

// Buffer (avatar inlining) and the in-memory limiter both need the Node runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUCCESS_CACHE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const ERROR_CACHE = 'public, max-age=60, s-maxage=60';
const UPSTREAM_TIMEOUT_MS = 8_000;

/** Reported on `X-Badge-Cache` so the storage layer is observable in prod. */
type CacheStatus = 'hit' | 'miss' | 'stale';

function etagFor(svg: string): string {
  return `"${createHash('sha256').update(svg).digest('hex').slice(0, 32)}"`;
}

function svgResponse(
  svg: string,
  {
    status = 200,
    cache = SUCCESS_CACHE,
    cacheStatus,
  }: { status?: number; cache?: string; cacheStatus?: CacheStatus } = {},
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': cache,
    // The badge is meant to be embedded anywhere, but it must never be
    // sniffed into something executable.
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    ETag: etagFor(svg),
  };

  if (cacheStatus) headers['X-Badge-Cache'] = cacheStatus;

  return new Response(svg, { status, headers });
}

function errorResponse(message: string, status: number, theme: Theme): Response {
  return svgResponse(renderErrorBadge(message, theme), { status, cache: ERROR_CACHE });
}

/** 304 when the caller already holds this exact badge. */
function notModified(request: Request, svg: string): Response | null {
  const etag = etagFor(svg);
  if (request.headers.get('if-none-match') !== etag) return null;

  return new Response(null, {
    status: 304,
    headers: { ETag: etag, 'Cache-Control': SUCCESS_CACHE },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const theme = (() => {
    const requested = new URL(request.url).searchParams.get('theme');
    return isTheme(requested) ? requested : 'dark';
  })();

  const { username: raw } = await params;
  // A malformed escape such as "%zz" makes decodeURIComponent throw; that is a
  // bad request, not a server error.
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  })();

  const username = decoded === null ? null : parseUsername(decoded);

  if (!username) {
    return errorResponse('That is not a valid GitHub username.', 400, theme);
  }

  const limit = rateLimit(clientKey(request));
  if (!limit.allowed) {
    return new Response(renderErrorBadge('Too many requests, slow down a little.', theme), {
      status: 429,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
      },
    });
  }

  // A stored badge that is still fresh skips GitHub entirely, which is what
  // keeps a widely-embedded README from exhausting the API quota.
  const stored = await readStoredBadge(username, theme);
  if (stored && !stored.stale) {
    return notModified(request, stored.svg) ?? svgResponse(stored.svg, { cacheStatus: 'hit' });
  }

  const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);

  try {
    const stats = await fetchStats(username, timeout);
    const score = scoreProfile(stats);
    const svg = renderBadge(stats, theme, score);

    // `after` keeps the upload off the response path without risking the
    // serverless instance being frozen mid-write.
    after(() => storeBadge(username, theme, svg));

    return notModified(request, svg) ?? svgResponse(svg, { cacheStatus: 'miss' });
  } catch (error) {
    // GitHub is down, slow, or rate-limiting us — an expired badge still beats
    // an error card in somebody's README.
    if (stored) {
      return svgResponse(stored.svg, { cacheStatus: 'stale', cache: ERROR_CACHE });
    }

    if (error instanceof GitHubError) {
      const message =
        error.status === 404 ? `No GitHub user called "${username}".` : error.message;
      return errorResponse(message, error.status, theme);
    }

    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return errorResponse('GitHub took too long to answer.', 504, theme);
    }

    console.error('badge generation failed', error);
    return errorResponse('Something went wrong generating this badge.', 500, theme);
  }
}
