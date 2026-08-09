import { createHash } from 'crypto';
import { DEFAULT_THEME, isTheme, renderBadge, renderErrorBadge, type Theme } from '@/lib/badge';
import { debugLog, startTimer } from '@/lib/debug';
import { fetchStats, GitHubError } from '@/lib/github';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { scoreProfile } from '@/lib/scoring';
import { isStorageConfigured, readStoredBadge, storeBadge } from '@/lib/storage/r2';
import { parseUsername } from '@/lib/username';

// Buffer (avatar inlining) and the in-memory limiter both need the Node runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUCCESS_CACHE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const ERROR_CACHE = 'public, max-age=60, s-maxage=60';
const UPSTREAM_TIMEOUT_MS = 8_000;

/** Reported on `X-Badge-Cache` so the storage layer is observable in prod. */
type CacheStatus = 'hit' | 'miss' | 'stale';

/**
 * Reported on `X-Badge-Stored`. The studio uses it to decide whether it may
 * hand out the public Cloudflare URL — offering one for an object that was
 * never written would put a broken image in somebody's README.
 */
type StoredStatus = 'hit' | 'written' | 'failed' | 'off';

function etagFor(svg: string): string {
  return `"${createHash('sha256').update(svg).digest('hex').slice(0, 32)}"`;
}

function svgResponse(
  svg: string,
  {
    status = 200,
    cache = SUCCESS_CACHE,
    cacheStatus,
    storedStatus,
  }: {
    status?: number;
    cache?: string;
    cacheStatus?: CacheStatus;
    storedStatus?: StoredStatus;
  } = {},
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': cache,
    // The badge is meant to be embedded anywhere, but it must never be
    // sniffed into something executable.
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    // Same-origin callers read these; they carry no user data.
    'Access-Control-Expose-Headers': 'X-Badge-Cache, X-Badge-Stored',
    ETag: etagFor(svg),
  };

  if (cacheStatus) headers['X-Badge-Cache'] = cacheStatus;
  if (storedStatus) headers['X-Badge-Stored'] = storedStatus;

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
  const elapsed = startTimer();

  const theme = (() => {
    const requested = new URL(request.url).searchParams.get('theme');
    return isTheme(requested) ? requested : DEFAULT_THEME;
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
    debugLog('badge', { user: raw.slice(0, 40), result: 'invalid', ms: elapsed() });
    return errorResponse('That is not a valid GitHub username.', 400, theme);
  }

  const limit = rateLimit(clientKey(request));
  if (!limit.allowed) {
    debugLog('badge', { user: username, result: 'rate-limited', ms: elapsed() });
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
    debugLog('badge', { user: username, theme, cache: 'hit', github: false, ms: elapsed() });
    return (
      notModified(request, stored.svg) ??
      svgResponse(stored.svg, { cacheStatus: 'hit', storedStatus: 'hit' })
    );
  }

  const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);

  try {
    const stats = await fetchStats(username, timeout);
    const score = scoreProfile(stats);
    const svg = renderBadge(stats, theme, score);

    // Awaited rather than deferred: the studio hands out the public Cloudflare
    // URL for this object, so it has to exist before the response says it does.
    // On a miss the request is already spending seconds on the GitHub API, so
    // one more round trip is not what makes it slow.
    const written = await storeBadge(username, theme, svg);
    const storedStatus: StoredStatus = isStorageConfigured()
      ? written
        ? 'written'
        : 'failed'
      : 'off';

    debugLog('badge', {
      user: username,
      theme,
      cache: 'miss',
      github: true,
      title: score.archetype,
      tier: score.tier,
      stored: storedStatus,
      bytes: svg.length,
      ms: elapsed(),
    });

    return notModified(request, svg) ?? svgResponse(svg, { cacheStatus: 'miss', storedStatus });
  } catch (error) {
    // GitHub is down, slow, or rate-limiting us — an expired badge still beats
    // an error card in somebody's README.
    if (stored) {
      debugLog('badge', { user: username, theme, cache: 'stale', ms: elapsed() });
      return svgResponse(stored.svg, {
        cacheStatus: 'stale',
        storedStatus: 'hit',
        cache: ERROR_CACHE,
      });
    }

    if (error instanceof GitHubError) {
      const message =
        error.status === 404 ? `No GitHub user called "${username}".` : error.message;
      debugLog('badge', { user: username, result: 'github-error', status: error.status, ms: elapsed() });
      return errorResponse(message, error.status, theme);
    }

    if (error instanceof DOMException && error.name === 'TimeoutError') {
      debugLog('badge', { user: username, result: 'github-timeout', ms: elapsed() });
      return errorResponse('GitHub took too long to answer.', 504, theme);
    }

    console.error('badge generation failed', error);
    debugLog('badge', { user: username, result: 'error', ms: elapsed() });
    return errorResponse('Something went wrong generating this badge.', 500, theme);
  }
}
