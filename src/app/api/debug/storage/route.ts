import { DEFAULT_THEME, isTheme } from '@/lib/badge';
import { debugEnabled } from '@/lib/debug';
import { badgeKey, publicBadgeUrl } from '@/lib/storage/key';
import { BADGE_TTL_MS, isStorageConfigured, publicBaseUrl, readStoredBadge } from '@/lib/storage/r2';
import { parseUsername } from '@/lib/username';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Development-only view of the storage layer: is it configured, is a given
 * badge actually in the bucket, how old is it, and what public URL would a
 * README use.
 *
 * Strictly dev — there is no flag to expose it in production, because it names
 * the bucket. Runtime tracing is the production equivalent (`BADGE_DEBUG=1`).
 *
 *     curl "http://localhost:3000/api/debug/storage?u=devnsko"
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const requestedTheme = params.get('theme');
  const theme = isTheme(requestedTheme) ? requestedTheme : DEFAULT_THEME;
  const username = parseUsername(params.get('u') ?? '');

  const base = publicBaseUrl();
  const configured = isStorageConfigured();

  const body: Record<string, unknown> = {
    configured,
    bucket: process.env.R2_BUCKET ?? null,
    endpointOverridden: Boolean(process.env.R2_ENDPOINT),
    publicBaseUrl: base,
    ttlHours: BADGE_TTL_MS / 3_600_000,
    debugLogging: debugEnabled,
  };

  if (username) {
    const key = badgeKey(username, theme);
    const stored = configured ? await readStoredBadge(username, theme) : null;

    body.probe = {
      username,
      theme,
      key,
      found: Boolean(stored),
      bytes: stored?.svg.length ?? null,
      lastModified: stored?.lastModified?.toISOString() ?? null,
      ageMinutes: stored?.lastModified
        ? Math.round((Date.now() - stored.lastModified.getTime()) / 60_000)
        : null,
      stale: stored?.stale ?? null,
      publicUrl: base ? publicBadgeUrl(base, username, theme) : null,
    };
  } else {
    body.hint = 'Add ?u=<github-username> to probe a stored badge.';
  }

  return Response.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
