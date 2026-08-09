import 'server-only';
import { AwsClient } from 'aws4fetch';
import type { Theme } from '../badge';
import { debugLog, startTimer } from '../debug';
import { badgeKey, checkPublicBaseUrl } from './key';

/**
 * Cloudflare R2, addressed over its S3-compatible API.
 *
 * There is no database here on purpose: the SVG *is* the record. The object key
 * carries the identity (username + theme) and R2's own `Last-Modified` carries
 * the freshness, so nothing else has to be tracked or migrated.
 *
 * `aws4fetch` is a ~4kB SigV4 signer over plain `fetch`, chosen over the AWS SDK
 * to keep the serverless bundle small.
 */

/** How long a stored badge is served without re-reading GitHub. */
export const BADGE_TTL_MS = 6 * 60 * 60 * 1000;

/** The cache must never become the slowest part of generating a badge. */
const STORAGE_TIMEOUT_MS = 3_000;

export interface StoredBadge {
  svg: string;
  lastModified: Date | null;
  /** True once past the TTL: regenerate if GitHub is reachable, else serve as-is. */
  stale: boolean;
}

interface R2Config {
  client: AwsClient;
  bucketUrl: string;
  bucket: string;
}

/** Keyed by the credentials it was built from, so a config change is picked up. */
let cache: { signature: string; config: R2Config | null } | undefined;

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

let warnedAboutPublicBase: string | null = null;

/**
 * The validated public bucket URL, or null. A misconfigured value is rejected
 * rather than passed on: the snippets built from it go straight into READMEs,
 * where a URL that needs authentication renders as nothing at all.
 */
export function publicBaseUrl(): string | null {
  const raw = process.env.R2_PUBLIC_BASE_URL || null;
  const { url, problem } = checkPublicBaseUrl(raw);

  // Loud, but only once per process per distinct value.
  if (problem && warnedAboutPublicBase !== raw) {
    warnedAboutPublicBase = raw;
    console.warn(`[r2] ${problem}`);
  }

  return url;
}

function getConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  // Points at any S3-compatible endpoint: MinIO locally, R2 in production.
  const endpoint = process.env.R2_ENDPOINT;

  const signature = [accountId, accessKeyId, secretAccessKey, bucket, endpoint].join(' ');
  if (cache?.signature === signature) return cache.config;

  const config =
    !accountId || !accessKeyId || !secretAccessKey || !bucket
      ? null
      : {
          client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
          bucketUrl: `${(endpoint ?? `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, '')}/${encodeURIComponent(bucket)}`,
          bucket,
        };

  cache = { signature, config };
  return config;
}

/**
 * Signs the request, then issues it separately with the original body.
 *
 * `AwsClient.fetch` hands its signed `Request` straight to `fetch`, and a
 * Request's body is a stream — undici then sends it chunked with no
 * `Content-Length`, which R2 rejects with `411 Length Required`. Passing the
 * raw string body to `fetch` lets the runtime compute the length itself.
 *
 * This also drops aws4fetch's retry loop, which is the behaviour we want: the
 * cache is optional, so a failure should be immediate rather than retried with
 * backoff while a badge request waits.
 */
async function signedFetch(
  config: R2Config,
  key: string,
  init: { method: string; body?: string; headers?: Record<string, string> },
): Promise<Response> {
  const url = `${config.bucketUrl}/${key}`;

  const signed = await config.client.sign(url, {
    method: init.method,
    body: init.body,
    headers: init.headers,
  });

  return fetch(url, {
    method: init.method,
    headers: signed.headers,
    body: init.body,
    signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
  });
}

/** Storage is best-effort: an R2 outage costs the cache, never the request. */
function warn(operation: string, error: unknown): null {
  console.warn(`[r2] ${operation} failed`, error);
  return null;
}

/** Drains a body we are not going to read, so the connection can be reused. */
async function drain(res: Response): Promise<void> {
  await res.arrayBuffer().catch(() => undefined);
}

export async function readStoredBadge(username: string, theme: Theme): Promise<StoredBadge | null> {
  const config = getConfig();
  if (!config) {
    debugLog('r2.read.skip', { reason: 'not configured' });
    return null;
  }

  const key = badgeKey(username, theme);
  const elapsed = startTimer();

  try {
    const res = await signedFetch(config, key, { method: 'GET' });

    if (res.status === 404) {
      await drain(res);
      debugLog('r2.read', { key, result: 'miss', ms: elapsed() });
      return null;
    }

    if (!res.ok) {
      await drain(res);
      debugLog('r2.read', { key, result: 'error', status: res.status, ms: elapsed() });
      return warn('readStoredBadge', new Error(`R2 responded ${res.status}`));
    }

    const svg = await res.text();
    const header = res.headers.get('last-modified');
    const parsed = header ? Date.parse(header) : Number.NaN;
    const lastModified = Number.isNaN(parsed) ? null : new Date(parsed);
    // Without a timestamp we cannot prove freshness, so assume stale.
    const stale = lastModified === null || Date.now() - lastModified.getTime() > BADGE_TTL_MS;

    debugLog('r2.read', {
      key,
      result: stale ? 'stale' : 'hit',
      bytes: svg.length,
      ageMin: lastModified ? Math.round((Date.now() - lastModified.getTime()) / 60_000) : null,
      ms: elapsed(),
    });

    return { svg, lastModified, stale };
  } catch (error) {
    debugLog('r2.read', { key, result: 'threw', ms: elapsed() });
    return warn('readStoredBadge', error);
  }
}

/** Resolves true when the object is durably stored. */
export async function storeBadge(username: string, theme: Theme, svg: string): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    debugLog('r2.write.skip', { reason: 'not configured' });
    return false;
  }

  const key = badgeKey(username, theme);
  const elapsed = startTimer();

  try {
    const res = await signedFetch(config, key, {
      method: 'PUT',
      body: svg,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        // Applies when the bucket is exposed through a public r2.dev or custom
        // domain and badges are served straight off Cloudflare's edge.
        'Cache-Control': 'public, max-age=3600',
      },
    });

    await drain(res);

    if (!res.ok) {
      debugLog('r2.write', { key, result: 'error', status: res.status, ms: elapsed() });
      warn('storeBadge', new Error(`R2 responded ${res.status}`));
      return false;
    }

    debugLog('r2.write', { key, result: 'ok', bytes: svg.length, ms: elapsed() });
    return true;
  } catch (error) {
    debugLog('r2.write', { key, result: 'threw', ms: elapsed() });
    warn('storeBadge', error);
    return false;
  }
}
