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
