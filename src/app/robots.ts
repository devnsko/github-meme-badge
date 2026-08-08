import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Badge responses are generated per request; there is nothing to index.
      disallow: '/api/',
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
