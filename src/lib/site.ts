/**
 * Absolute base URL for metadata and copyable snippets. `VERCEL_PROJECT_PRODUCTION_URL`
 * is set automatically on Vercel; set `NEXT_PUBLIC_SITE_URL` for any other host.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export const site = {
  name: 'Meme GitHub Badge',
  title: 'Meme GitHub Badge — a README badge with a sense of humour',
  description:
    'Generate a self-contained SVG badge from any GitHub profile: real stats, an inlined avatar, an earned title, and a punchline picked for you. Drop it straight into your README.',
} as const;
