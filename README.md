# Meme GitHub Badge

Generate a self-contained SVG badge from any GitHub profile: real stats, an inlined avatar, an earned title, and a punchline that stays the same every time someone loads your README. Drawn as a paper sticker — thick ink outlines, hard offset shadows, no gradients.

```markdown
![My GitHub meme badge](https://your-deployment.example.com/api/badges/octocat)
```

<!-- Replace the host above with your own deployment. -->

---

## Why it is built this way

A README badge is an unusual thing to serve. It is fetched by image proxies rather than browsers, cached aggressively by people you will never meet, and embedded in pages you do not control. Three constraints follow from that, and they shaped most of the code:

**The badge must be one file with no external references.** GitHub serves README images through its Camo proxy, which fetches the SVG and nothing else — an `<image href="https://…">` pointing at an avatar simply never loads. So the avatar is downloaded server-side and inlined as a base64 `data:` URI ([`src/lib/github.ts`](src/lib/github.ts)).

**The badge must render outside a browser.** CSS custom properties (`var(--bg)`) are a browser feature; librsvg and resvg — used by thumbnailers, unfurlers and conversion pipelines — render an unresolved `var()` as black. Every colour is therefore written as a literal presentation attribute. The `auto` theme layers a `prefers-color-scheme: dark` media query on top, so browsers switch to dark while other renderers keep the light defaults ([`src/lib/badge.ts`](src/lib/badge.ts)).

The same constraint shapes the sticker look: the drop shadow is a duplicated shape offset by a few pixels, not an `feDropShadow` filter, and there are no gradients. Strict renderers are also unforgiving about markup — a shape carrying both a fill role and a stroke role once emitted two `class` attributes, which browsers ignore but librsvg treats as a fatal parse error, turning the badge into a broken image everywhere except a browser. A test now walks every tag looking for duplicated attributes.

**The joke must not change on every request.** The punchline is picked with an FNV-1a hash of the username rather than `Math.random()`, so a cache miss does not silently rewrite someone's README ([`src/lib/meme.ts`](src/lib/meme.ts)).

There is no font engine in the runtime and the badge has to know its own height before it is drawn, so line wrapping runs on an estimated glyph-width table ([`src/lib/text.ts`](src/lib/text.ts)).

## Titles and scoring

Every badge carries a short earned title — `Fork Overlord`, `Polyglot Menace`, `Touch Grass Later`. It is not decorative: it falls out of a scoring pass over eleven signals, folded into seven normalised axes ([`src/lib/scoring.ts`](src/lib/scoring.ts)).

| Axis | Built from |
| --- | --- |
| `reach` | total stars, followers |
| `influence` | forks, share of repos with at least one star |
| `output` | public repos, gists |
| `craft` | average stars per original repo, hit rate |
| `diversity` | distinct languages across original repos |
| `activity` | days since the most recent push |
| `tenure` | account age |

Counts are normalised logarithmically. GitHub numbers span six orders of magnitude, so a linear scale would flatten almost everyone to zero and leave two accounts alone at the ceiling.

The **archetype** is the axis a profile leans on hardest — which is why three famous repos read differently from two hundred quiet ones at a similar overall level. `activity` and `tenure` are discounted when choosing, because nearly everyone scores on them. Two states override the axes entirely: a year of silence makes an account `dormant` no matter how many stars it has, and a young, sparse account is a `rookie`.

The **tier** (`low` / `mid` / `high`) comes from the weighted overall score and selects which pool the title is drawn from — 108 titles across 9 archetypes × 3 tiers, plus 40 taglines and ~90 stat-aware punchlines in [`src/lib/copy.ts`](src/lib/copy.ts). Stars and forks alone counted only original repos: a fork's stars belong to whoever wrote it.

Every choice is seeded with an FNV-1a hash of the username, never `Math.random()`, so the badge in your README does not quietly rewrite itself.

## API

```
GET /api/badges/:username
```

| Parameter | Values | Notes |
| --- | --- | --- |
| `:username` | GitHub login | An `@handle` or a full profile URL is accepted and normalised. |
| `?theme` | `light` (default), `dark`, `auto` | `auto` follows the viewer's system colour scheme. |

Responds with `image/svg+xml`. Errors are rendered *as a badge* rather than as JSON — the endpoint is consumed by `<img>`, where a JSON body shows up as a broken-image icon with no explanation. The HTTP status is still accurate (`400`, `404`, `429`, `504`, `500`), and `ETag` / `If-None-Match` are honoured.

```bash
curl "http://localhost:3000/api/badges/octocat?theme=dark"
```

### Caching and limits

- Responses carry `s-maxage=3600, stale-while-revalidate=86400`, so a CDN absorbs the repeat traffic a popular README generates.
- Stars and forks are summed over the 300 most recently pushed repositories. Accounts above that show a `+` suffix on those figures.
- Per-client rate limiting is a fixed window held in process memory. On serverless the real ceiling is *limit × instances* — deliberate, so that a Redis instance is not a hard dependency ([`src/lib/rate-limit.ts`](src/lib/rate-limit.ts)).
- Badges can additionally be stored in Cloudflare R2, which skips GitHub entirely on a cache hit. See [Storage](#storage-cloudflare-r2-optional).

## Storage (Cloudflare R2, optional)

Generated badges are stored in R2 as plain SVG objects, keyed by username ([`src/lib/storage/r2.ts`](src/lib/storage/r2.ts)):

```
badges/<username>/<theme>.svg
```

**There is no database, and none is needed.** The SVG *is* the record: the object key carries the identity and R2's own `Last-Modified` carries the freshness, so there is no schema to migrate and no second system to keep in sync. Keys are lowercased, since GitHub logins are case-insensitive and `OctoCat` must not become a second object.

With storage configured the route gains three behaviours:

- **A fresh stored badge skips GitHub entirely.** Within the 6-hour TTL the SVG is served straight from R2, which is what stops a widely-embedded README from spending the API quota.
- **A stale badge beats an error.** If GitHub is down, slow, or rate-limiting, the expired object is served instead of an error card.
- **READMEs are pointed at Cloudflare, not at this app.** With `R2_PUBLIC_BASE_URL` set, the copy-ready snippets use the public object URL, so an embedded badge is served by Cloudflare's edge and never reaches this deployment.

Two response headers make that observable, and the studio depends on the second:

| Header | Values |
| --- | --- |
| `X-Badge-Cache` | `hit` · `miss` · `stale` |
| `X-Badge-Stored` | `hit` · `written` · `failed` · `off` |

The public URL is only offered once `X-Badge-Stored` confirms the object is really in the bucket — handing out a link to an object that was never written would put a broken image in somebody's README. If R2 is misconfigured or down, the snippets quietly fall back to this app's URL.

For the same reason the upload is awaited rather than deferred with `after()`: the snippet claims the object exists, so it has to exist before the response says so. On a cache miss the request is already spending seconds on the GitHub API, so one more round trip is not what makes it slow.

Storage stays optional throughout: with the environment unset every entry point is a no-op, and an R2 outage costs the cache, never the request. Reads and writes are capped at 3s.

### Debugging

Development traces every step; `BADGE_DEBUG=1` keeps it on anywhere else. The fields are keys, sizes, timings and status codes — no secrets.

```
[badge] r2.read key=badges/devnsko/light.svg result=miss ms=31
[badge] r2.write key=badges/devnsko/light.svg result=ok bytes=10438 ms=21
[badge] badge user=devnsko theme=light cache=miss github=true stored=written bytes=10438 ms=800
[badge] r2.read key=badges/devnsko/light.svg result=hit bytes=10438 ageMin=0 ms=18
[badge] badge user=devnsko theme=light cache=hit github=false ms=19
```

A development-only endpoint answers "is it configured, and is this badge actually in the bucket":

```bash
curl "http://localhost:3000/api/debug/storage?u=devnsko"
```

It reports `configured`, the bucket, the public base URL, and — with `?u=` — the object key, whether it was found, its size, age, staleness and public URL. It returns 404 in production with no flag to override, because it names the bucket.

### Setting it up

Create a bucket and an R2 API token with **Object Read & Write**, then set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`. Nothing else — no migration step.

R2 is reached over its S3-compatible API, signed with [`aws4fetch`](https://github.com/mhart/aws4fetch) (~4kB over plain `fetch`) rather than the AWS SDK, which would add megabytes to a serverless bundle for one PUT and one GET. `R2_ENDPOINT` points the same code at any S3-compatible store, which is how the integration tests run against a local stub — and how you can run against MinIO locally.

### Serving badges from the edge

Turn on public access for the bucket (**R2 → bucket → Settings → Public access**) and set `R2_PUBLIC_BASE_URL` to the r2.dev subdomain it gives you, or to a custom domain:

```
R2_PUBLIC_BASE_URL=https://pub-0123456789abcdef.r2.dev
```

**This is not the S3 API endpoint.** `https://<account>.r2.cloudflarestorage.com` is the authenticated API: objects genuinely live there, but every GET needs a SigV4 signature, so an anonymous fetch gets a `400` with an XML error body. GitHub's image proxy receives that instead of an image and renders nothing — the README shows bare link text and looks, misleadingly, like a broken badge rather than a broken URL. Setting it is rejected with an explanation in the logs, and the snippets fall back to this app's URL.

Note also that neither a r2.dev subdomain nor a custom domain includes the bucket name in the path; the host already identifies the bucket.

One wrinkle worth knowing about: the request is signed and issued in two steps rather than through `AwsClient.fetch`. That helper passes its signed `Request` straight to `fetch`, and a Request's body is a stream — undici then sends it chunked with no `Content-Length`, and R2 answers `411 Length Required`. Signing separately and handing the raw string body to `fetch` lets the runtime compute the length itself.

[`r2.ts`](src/lib/storage/r2.ts) opens with `import 'server-only'`, which turns an accidental import from a client component into a build error — the bucket credentials must never reach the browser.

## Running locally

```bash
npm install
```

```bash
npm run dev
```

Copy `.env.example` to `.env.local` if you want to raise the GitHub rate limit:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | No | A token with **no scopes** lifts the GitHub REST limit from 60 to 5,000 requests/hour. Without it the app still works, just with the anonymous quota. |
| `NEXT_PUBLIC_SITE_URL` | No | Absolute URL used for metadata and the copyable snippets. Inferred automatically on Vercel. |
| `R2_ACCOUNT_ID` | No | Cloudflare account. All four R2 variables must be set to enable storage. |
| `R2_ACCESS_KEY_ID` | No | From an R2 API token with Object Read & Write. |
| `R2_SECRET_ACCESS_KEY` | No | Server-side only. Never prefix it with `NEXT_PUBLIC_`. |
| `R2_BUCKET` | No | Bucket the badge objects are written to. |
| `R2_ENDPOINT` | No | Override for any S3-compatible endpoint, e.g. MinIO. |
| `R2_PUBLIC_BASE_URL` | No | Public bucket URL. Set it to serve embedded badges from Cloudflare's edge. |
| `BADGE_DEBUG` | No | `1` keeps runtime tracing on outside development. |

## Checks

```bash
npm run verify
```

Runs ESLint, `tsc --noEmit` and the Vitest suite. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all three plus a production build on every push and pull request.

The tests cover the parts worth protecting: username parsing rejects traversal attempts rather than sanitising them, hostile profile fields are escaped instead of emitted as markup, an avatar that is not a base64 image data URI is dropped, wrapping stays inside its width budget, and no theme ever emits a `var(--…)`.

## Deploying

Any Node host works; the project targets Vercel. Import the repository, optionally set `GITHUB_TOKEN`, and deploy — no other configuration is needed. The badge route runs on the Node.js runtime because it inlines avatars with `Buffer`.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Cloudflare R2 (optional) · Vitest · GitHub REST API

## Licence

MIT — see [LICENSE](LICENSE).
