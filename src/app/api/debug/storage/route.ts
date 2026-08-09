import { DEFAULT_THEME, isTheme } from '@/lib/badge';
import { debugEnabled } from '@/lib/debug';
import { badgeKey, checkPublicBaseUrl, publicBadgeUrl } from '@/lib/storage/key';
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
/**
 * Fetches the public URL with no credentials — the same thing GitHub's image
 * proxy does. A bucket that has not been made public answers with an error and
 * an XML body, which renders in a README as bare link text rather than an
 * image, so the useful question is not "does the object exist" but "does an
 * anonymous stranger get an image".
 */
async function checkPubliclyEmbeddable(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    const contentType = res.headers.get('content-type');
    await res.body?.cancel();

    const embeddable = res.ok && Boolean(contentType?.startsWith('image/'));

    return {
      status: res.status,
      contentType,
      embeddable,
      hint: embeddable
        ? null
        : res.status === 401 || res.status === 403 || res.status === 400
          ? 'The bucket is not public. Enable the Public Development URL (or attach a custom domain) in the R2 bucket settings, then set R2_PUBLIC_BASE_URL to that host.'
          : res.status === 404
            ? 'The bucket is reachable but this object is not there yet — generate the badge once, then re-check.'
            : `Reachable but not embeddable: GitHub needs an image content type, got ${contentType ?? 'none'}.`,
    };
  } catch (error) {
    return {
      status: null,
      contentType: null,
      embeddable: false,
      hint: `Could not reach the public URL: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

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
  const { problem } = checkPublicBaseUrl(process.env.R2_PUBLIC_BASE_URL);

  const body: Record<string, unknown> = {
    configured,
    bucket: process.env.R2_BUCKET ?? null,
    endpointOverridden: Boolean(process.env.R2_ENDPOINT),
    publicBaseUrl: base,
    // Surfaces a public URL that would render as bare link text in a README.
    publicBaseUrlProblem: problem,
    ttlHours: BADGE_TTL_MS / 3_600_000,
    debugLogging: debugEnabled,
  };

  if (username) {
    const key = badgeKey(username, theme);
    const stored = configured ? await readStoredBadge(username, theme) : null;
    const publicUrl = base ? publicBadgeUrl(base, username, theme) : null;

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
      publicUrl,
    };

    if (publicUrl) body.publicFetch = await checkPubliclyEmbeddable(publicUrl);
  } else {
    body.hint = 'Add ?u=<github-username> to probe a stored badge.';
  }

  return Response.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
