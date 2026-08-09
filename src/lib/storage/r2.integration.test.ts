import { createServer, type IncomingMessage, type Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BADGE_TTL_MS, readStoredBadge, storeBadge } from './r2';

/**
 * Drives the real signing and request-building code against a local
 * S3-compatible stub. Credentials for live R2 are not available in CI, and the
 * part worth protecting is what this app sends, not what Cloudflare stores.
 */
interface Captured {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

let server: Server;
let captured: Captured[] = [];
let respond: (req: Captured) => { status: number; body?: string; headers?: Record<string, string> };

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const entry: Captured = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      };
      captured.push(entry);

      const reply = respond(entry);
      res.writeHead(reply.status, reply.headers ?? {});
      res.end(reply.body ?? '');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  process.env.R2_ACCOUNT_ID = 'test-account';
  process.env.R2_ACCESS_KEY_ID = 'test-key-id';
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
  process.env.R2_BUCKET = 'meme-badges';
  process.env.R2_ENDPOINT = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_ENDPOINT']) {
    delete process.env[key];
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  captured = [];
  vi.restoreAllMocks();
});

describe('storeBadge', () => {
  it('PUTs the SVG to the username-scoped key with a signed request', async () => {
    respond = () => ({ status: 200 });

    await storeBadge('OctoCat', 'dark', '<svg>badge</svg>');

    expect(captured).toHaveLength(1);
    const [request] = captured;

    expect(request.method).toBe('PUT');
    expect(request.url).toBe('/meme-badges/badges/octocat/dark.svg');
    expect(request.body).toBe('<svg>badge</svg>');
    expect(request.headers['content-type']).toContain('image/svg+xml');

    // R2 answers `411 Length Required` for a chunked PUT. Handing aws4fetch's
    // signed Request straight to fetch turns the body into a stream, which
    // undici sends without a Content-Length — so the length is the assertion
    // that matters here, not just that a request went out.
    expect(request.headers['content-length']).toBe(
      String(Buffer.byteLength('<svg>badge</svg>')),
    );
    expect(request.headers['transfer-encoding']).toBeUndefined();
    // SigV4, produced by aws4fetch — proves the request is actually signed.
    expect(request.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=test-key-id/);
    // aws4fetch declares the payload unsigned; R2 accepts that over TLS.
    expect(request.headers['x-amz-content-sha256']).toBe('UNSIGNED-PAYLOAD');
  });

  it('reports success so the caller knows the object is really there', async () => {
    respond = () => ({ status: 200 });
    await expect(storeBadge('octocat', 'dark', '<svg/>')).resolves.toBe(true);
  });

  it('reports failure and swallows the error instead of failing the caller', async () => {
    respond = () => ({ status: 500, body: 'boom' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(storeBadge('octocat', 'dark', '<svg/>')).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it('sends a body a strict S3 endpoint accepts, whatever its size', async () => {
    // A realistic badge carries a base64 avatar, so the body is ~13kB.
    const svg = `<svg>${'x'.repeat(13_000)}</svg>`;
    respond = () => ({ status: 200 });

    await storeBadge('octocat', 'light', svg);

    expect(captured[0].headers['content-length']).toBe(String(Buffer.byteLength(svg)));
    expect(captured[0].body).toHaveLength(svg.length);
  });
});

describe('readStoredBadge', () => {
  it('returns a fresh badge with its timestamp', async () => {
    respond = () => ({
      status: 200,
      body: '<svg>stored</svg>',
      headers: { 'last-modified': new Date().toUTCString() },
    });

    const stored = await readStoredBadge('octocat', 'light');

    expect(captured[0].method).toBe('GET');
    expect(captured[0].url).toBe('/meme-badges/badges/octocat/light.svg');
    expect(stored?.svg).toBe('<svg>stored</svg>');
    expect(stored?.stale).toBe(false);
    expect(stored?.lastModified).toBeInstanceOf(Date);
  });

  it('marks an object older than the TTL as stale', async () => {
    respond = () => ({
      status: 200,
      body: '<svg>old</svg>',
      headers: { 'last-modified': new Date(Date.now() - BADGE_TTL_MS - 60_000).toUTCString() },
    });

    expect((await readStoredBadge('octocat', 'dark'))?.stale).toBe(true);
  });

  it('treats a missing Last-Modified as stale rather than assuming freshness', async () => {
    respond = () => ({ status: 200, body: '<svg>undated</svg>' });

    const stored = await readStoredBadge('octocat', 'dark');
    expect(stored?.lastModified).toBeNull();
    expect(stored?.stale).toBe(true);
  });

  it('reports a missing object as a plain miss, not an error', async () => {
    respond = () => ({ status: 404, body: 'NoSuchKey' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(readStoredBadge('octocat', 'dark')).resolves.toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('degrades to a miss when R2 errors', async () => {
    respond = () => ({ status: 503, body: 'unavailable' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(readStoredBadge('octocat', 'dark')).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it('gives up quickly on a failing R2 instead of retrying for a minute', async () => {
    respond = () => ({ status: 503, body: 'unavailable' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const started = Date.now();
    await readStoredBadge('octocat', 'dark');

    // aws4fetch retries 5xx with exponential backoff by default; unbounded that
    // is ~51s of a badge request spent waiting on an optional cache.
    expect(Date.now() - started).toBeLessThan(1_500);
    expect(captured.length).toBeLessThanOrEqual(2);
  });
});
