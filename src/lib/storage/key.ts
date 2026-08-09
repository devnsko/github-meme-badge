import type { Theme } from '../badge';
import { isValidUsername } from '../username';

/**
 * Object-key rules, kept free of any server-only import so the browser can
 * build the same public URL the server writes to.
 */
const KEY_PREFIX = 'badges';

/**
 * `badges/<username>/<theme>.svg`, lowercased so GitHub's case-insensitive
 * logins do not create duplicate objects.
 *
 * Callers validate first, but a key is a path: building one from unvalidated
 * input is exactly how a traversal gets written into a bucket.
 */
export function badgeKey(username: string, theme: Theme): string {
  const login = username.toLowerCase();
  if (!isValidUsername(login)) {
    throw new Error(`Refusing to build an object key from ${JSON.stringify(username)}`);
  }

  return `${KEY_PREFIX}/${login}/${theme}.svg`;
}

/**
 * Public URL for a stored badge on an r2.dev or custom domain. A README
 * pointing here is served by Cloudflare's edge and never touches this app.
 */
export function publicBadgeUrl(baseUrl: string, username: string, theme: Theme): string {
  return `${baseUrl.replace(/\/+$/, '')}/${badgeKey(username, theme)}`;
}

/** `<account>.r2.cloudflarestorage.com` — the signed S3 API, never public. */
const S3_API_HOST = /(^|\.)r2\.cloudflarestorage\.com$/i;

/**
 * Validates a configured public base URL.
 *
 * The trap this exists for: the S3 API endpoint looks like a perfectly good
 * URL, and objects really do live at it, but every request there needs a SigV4
 * signature. Anonymous fetches get a 400 with an XML error body, so GitHub's
 * image proxy renders nothing and a README shows bare link text. A public
 * bucket is a different host entirely — the r2.dev subdomain or a custom
 * domain, both of which serve the key with no bucket name in the path.
 */
export function checkPublicBaseUrl(raw: string | null | undefined): {
  url: string | null;
  problem: string | null;
} {
  if (!raw) return { url: null, problem: null };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { url: null, problem: `R2_PUBLIC_BASE_URL is not a valid URL: ${raw}` };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { url: null, problem: `R2_PUBLIC_BASE_URL must be http(s), got ${parsed.protocol}` };
  }

  if (S3_API_HOST.test(parsed.hostname)) {
    return {
      url: null,
      problem:
        'R2_PUBLIC_BASE_URL points at the S3 API endpoint (r2.cloudflarestorage.com), which ' +
        'always requires authentication and cannot be embedded in a README. Enable public ' +
        "access on the bucket and use its r2.dev subdomain (https://pub-<id>.r2.dev) or a " +
        'custom domain — note that neither includes the bucket name in the path.',
    };
  }

  return { url: raw.replace(/\/+$/, ''), problem: null };
}
